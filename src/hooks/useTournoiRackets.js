// src/hooks/useTournoiRackets.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

/**
 * Gestion des raquettes d'un tournoi
 * - CRUD + realtime
 * - Lookups (clubs, tarif_matrix) pour calcul du tarif
 * - Stats + CA (revenuePaid) + priceForRow(r)
 */
export function useTournoiRackets(tournoiName) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Lookups pour le tarif
  const [clubs, setClubs] = useState([]);
  const [tarifMatrix, setTarifMatrix] = useState([]);

  const load = useCallback(async () => {
    if (!tournoiName) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tournoi_raquettes")
        .select(`
          id, tournoi, client_id, cordeur_id, cordage_id, tension, date, statut_id,
          reglement_mode, reglement_date, exported, club_id,
          offert, fourni, contacted_at,
          gain_cents, gain_frozen_at,
          raquette,
          client:clients(id, nom, prenom),
          cordeur:cordeur(cordeur),
          cordage:cordages(cordage, is_base)
        `)
        .eq("tournoi", tournoiName)
        .order("date",{ascending:false})
        .order("id",{ascending:false});

      if (error) throw error;
      setRows(data || []);
    } finally {
      setLoading(false);
    }
  }, [tournoiName]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime + events locaux
  useEffect(() => {
    if (!tournoiName) return;
    const channel = supabase
      .channel(`tournoi_raquettes:${tournoiName}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournoi_raquettes", filter: `tournoi=eq.${tournoiName}` },
        () => load()
      )
      .subscribe();

    const onLocal = (e) => {
      if (e?.detail?.tournoi === tournoiName) load();
    };
    window.addEventListener("tournoi:raquette:created", onLocal);

    return () => {
      window.removeEventListener("tournoi:raquette:created", onLocal);
      supabase.removeChannel(channel);
    };
  }, [tournoiName, load]);

  // Lookups (clubs + tarif matrix)
  useEffect(() => {
    (async () => {
      const [clubsRes, tmRes] = await Promise.all([
        supabase.from("clubs").select("clubs, bobine_base, bobine_specific"),
        supabase.from("tarif_matrix").select("*"),
      ]);
      if (!clubsRes.error && clubsRes.data) setClubs(clubsRes.data);
      if (!tmRes.error && tmRes.data) setTarifMatrix(tmRes.data);
    })();
  }, []);

  // --------- Actions ---------
  const remove = useCallback(
    async (id) => {
      const { error } = await supabase.from("tournoi_raquettes").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  const updateStatut = useCallback(
    async (id, statut_id) => {
      // Optimiste
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, statut_id } : r)));

      const patch = { statut_id };
      if (statut_id && (statut_id === "PAYE" || statut_id === "PAYÉ")) {
        patch.reglement_date = new Date().toISOString();
      }
      const { error } = await supabase.from("tournoi_raquettes").update(patch).eq("id", id);
      if (error) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, statut_id: null } : r)));
        throw error;
      }
      await load();
    },
    [load]
  );

  const markExported = useCallback(async (ids) => {
    const { error } = await supabase
      .from("tournoi_raquettes")
      .update({ exported: true })
      .in("id", ids);
    if (error) throw error;
  }, []);

  /**
   * Exporte vers "suivi".
   * @param {{ includeExported?: boolean }} opts - si true, inclut aussi les lignes déjà marquées exported
   */
  const exportAllToSuivi = useCallback(async (opts = {}) => {
    const includeExported = !!opts.includeExported;

    const toExport = rows.filter((r) => (includeExported ? true : !r.exported));
    if (!toExport.length) return { inserted: 0 };

    function toISODateOnly(d) {
  if (!d) return new Date().toISOString().slice(0, 10);

  const s = String(d);

  // déjà YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // timestamp ISO => garde juste le jour
  if (s.length >= 10 && s[4] === "-" && s[7] === "-") return s.slice(0, 10);

  const dt = new Date(s);
  if (isNaN(dt)) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

    const payloads = toExport.map((r) => {
      const clientName = r?.client ? `${r.client.nom || ""} ${r.client.prenom || ""}`.trim() || null : null;
      return {
        client_id: r.client_id || null,
        client_name: clientName,             // ⬅️ AJOUT
        cordage_id: r.cordage_id || null,
        tension: r.tension || null,
        cordeur_id: r.cordeur_id || null,
        statut_id: r.statut_id || null,
        date: toISODateOnly(r.date),
        raquette: r.raquette || null,
        club_id: r.club_id || null,
        reglement_mode: r.reglement_mode || null,
        reglement_date: r.reglement_date || null,
        fourni: !!r.fourni,
        offert: !!r.offert,
        lieu_id: tournoiName,
      };
    });    

    const { error } = await supabase.from("suivi").insert(payloads);
    if (error) throw new Error(`Insertion dans "suivi" refusée: ${error.message}`);

    // Si on ne force pas, on marque comme exporté (comportement identique à avant)
    if (!includeExported) {
      await markExported(toExport.map((x) => x.id));
    }

    window.dispatchEvent(new CustomEvent("suivi:created"));
    return { inserted: payloads.length };
  }, [rows, markExported, tournoiName]);

  // --------- Tarif par ligne ---------
  const priceForRow = useCallback(
    (r) => {
      if (r?.offert) return 0;
      if (r?.fourni) return 12;

      const club = clubs.find((c) => c.clubs === r.club_id);
      const isBase = r?.cordage?.is_base;
      if (!club || typeof isBase !== "boolean") return 0;

      const tm = tarifMatrix.find(
        (row) =>
          (!!row.bobine_base) === !!club.bobine_base &&
          (!!row.bobine_specific) === !!club.bobine_specific &&
          (!!row.is_base) === !!isBase
      );
      return tm ? (tm.price_cents || 0) / 100 : 0;
    },
    [clubs, tarifMatrix]
  );

  // --------- Stats + CA ---------
  const { stats, countsByStatut, revenuePaid } = useMemo(() => {
    const total = rows.length;
    const byCordeur = {};
    const byCordageCordeur = {};
    const byStatut = {};
    let revPaid = 0;

    rows.forEach((r) => {
      const cor = r?.cordeur?.cordeur || "—";
      byCordeur[cor] = (byCordeur[cor] || 0) + 1;

      const key = `${r?.cordage?.cordage || "—"} • ${cor}`;
      byCordageCordeur[key] = (byCordageCordeur[key] || 0) + 1;

      const s = r?.statut_id || "—";
      byStatut[s] = (byStatut[s] || 0) + 1;

      const sNorm = (s || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toUpperCase();
      if (sNorm === "PAYE") {
        revPaid += priceForRow(r);
      }
    });

    return {
      stats: { total, byCordeur, byCordageCordeur },
      countsByStatut: byStatut,
      revenuePaid: Math.round(revPaid),
    };
  }, [rows, priceForRow]);

  return {
    loading,
    rows,
    load,
    remove,
    updateStatut,
    exportAllToSuivi,
    stats,
    countsByStatut,
    revenuePaid,
    priceForRow,
  };
}
