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

  const [statuts, setStatuts] = useState([]);

  const load = useCallback(async () => {
    if (!tournoiName) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tournoi_raquettes")
        .select(`
          id, created_at, tournoi, client_id, cordeur_id, cordage_id, tension, date, statut_id,
          reglement_mode, reglement_date, exported, club_id,
          offert, fourni, contacted_at,
          gain_cents, gain_frozen_at,
          raquette,
          client:clients(id, nom, prenom),
          cordeur:cordeur(cordeur),
          cordage:cordages(cordage, is_base)
        `)
        .eq("tournoi", tournoiName)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
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

  useEffect(() => {
  (async () => {
    const { data, error } = await supabase.from("statuts").select("statut_id");
    if (!error) setStatuts(data || []);
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

  // --------- Tarif par ligne ---------
    const clubFlagsForRow = useCallback(
    (r) => {
      const club = clubs.find((c) => c.clubs === r.club_id);
      return {
        bobine_base: !!club?.bobine_base,
        bobine_specific: !!club?.bobine_specific,
      };
    },
    [clubs]
  );

  // --- utils ---
const U = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();

function pickStatus(wanted) {
  const target = U(wanted);
  const hit = (statuts || []).find(s => U(s.statut_id) === target);
  return hit ? hit.statut_id : null;
}

function canonStatutForSuivi(st) {
  const s = U(st);
  if (!s) return pickStatus("A FAIRE") || "A FAIRE";

  if (s === "PAYE" || s === "PAYÉ") return pickStatus("PAYE") || pickStatus("PAYÉ") || pickStatus("A REGLER") || "A FAIRE";
  if (s === "A REGLER" || s === "A RÉGLER") return pickStatus("A REGLER") || pickStatus("A RÉGLER") || "A FAIRE";
  if (s === "MESSAGE ENVOYE" || s === "MESSAGE ENVOYÉ") return pickStatus("MESSAGE ENVOYE") || pickStatus("MESSAGE ENVOYÉ") || pickStatus("A REGLER") || "A FAIRE";
  if (s === "RENDU") return pickStatus("RENDU") || "A FAIRE";
  if (s === "A FAIRE") return pickStatus("A FAIRE") || "A FAIRE";

  // fallback sûr
  return pickStatus("A FAIRE") || "A FAIRE";
}

function canonPayModeForSuivi(m) {
  const s = String(m || "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (!s) return null;
  if (s.includes("offert") || s.includes("gratuit")) return "Offert";
  if (s.includes("cheq")) return "Cheque";
  if (s.includes("cb") || s.includes("carte")) return "CB";
  if (s.startsWith("esp")) return "Especes";
  if (s.startsWith("vir")) return "Virement";
  return m;
}

// --- priceForRow ---
const priceForRow = useCallback(
  (r) => {
    if (r?.offert) return 0;
    if (r?.fourni) return 12;

    const club = clubs.find((c) => c.clubs === r.club_id);
    const isBase = r?.cordage?.is_base;
    if (!club || typeof isBase !== "boolean") return 0;

    // ✅ FABREGUES : spécifique = 12€
    if (U(club.clubs) === "FABREGUES" && club.bobine_base && club.bobine_specific && isBase === false) {
      return 12;
    }

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

// --- exportAllToSuivi ---
const exportAllToSuivi = useCallback(async (opts = {}) => {
  const includeExported = !!opts.includeExported;

  const toExport = (rows || []).filter((r) => (includeExported ? true : !r.exported));
  if (!toExport.length) return { inserted: 0 };

  const toISODateOnly = (d) => {
    if (!d) return new Date().toISOString().slice(0, 10);
    const s = String(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.length >= 10 && s[4] === "-" && s[7] === "-") return s.slice(0, 10);
    const dt = new Date(s);
    if (isNaN(dt)) return new Date().toISOString().slice(0, 10);
    return dt.toISOString().slice(0, 10);
  };

  // 1) construit les payloads + mémorise le tarif voulu par ligne
  const payloads = toExport.map((r) => {
    const clientName = r?.client
      ? `${r.client.nom || ""} ${r.client.prenom || ""}`.trim() || null
      : null;

    const isOffert = r.offert === true || /offert/i.test(String(r.reglement_mode || ""));
    const reglementModeSuivi = isOffert ? "Offert" : canonPayModeForSuivi(r.reglement_mode);

    // ✅ tarif "métier" du tournoi (inclut exception FABREGUES)
    const tarifEur = isOffert ? 0 : Number(priceForRow(r) || 0);

    return {
      client_id: r.client_id || null,
      client_name: clientName,
      cordage_id: r.cordage_id || null,
      tension: r.tension || null,
      cordeur_id: r.cordeur_id || null,

      // ✅ IMPORTANT: suivi.tarif est un TEXTE
      tarif: String(tarifEur),

      // ✅ statut FK-safe
      statut_id: canonStatutForSuivi(r.statut_id),

      date: toISODateOnly(r.date),
      raquette: r.raquette || null,
      club_id: r.club_id || null,

      reglement_mode: reglementModeSuivi || null,
      reglement_date: reglementModeSuivi ? (r.reglement_date || new Date().toISOString()) : null,

      contacted_at: r.contacted_at ?? null,

      fourni: !!r.fourni,
      offert: !!isOffert,
      lieu_id: tournoiName,
    };
  });

  // 2) insert + récupère les ids créés
  const { data: inserted, error: insertErr } = await supabase
    .from("suivi")
    .insert(payloads)
    .select("id");

  if (insertErr) {
    throw new Error(`Insertion dans "suivi" refusée: ${insertErr.message}`);
  }

  // 3) anti-écrasement : on re-force le tarif après insert
  const ids = (inserted || []).map((x) => x.id).filter(Boolean);
  if (ids.length) {
    // mapping id -> tarif (même ordre que payloads)
    await Promise.all(
      ids.map((id, i) =>
        supabase.from("suivi").update({ tarif: payloads[i].tarif }).eq("id", id)
      )
    );
  }

  // 4) marque exported côté tournoi (comme avant)
  if (!includeExported) {
    await markExported(toExport.map((x) => x.id));
  }

  window.dispatchEvent(new CustomEvent("suivi:created"));
  return { inserted: payloads.length };
}, [rows, tournoiName, priceForRow, markExported]);

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
    clubFlagsForRow
  };
}
