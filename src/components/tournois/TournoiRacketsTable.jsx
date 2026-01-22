// src/components/tournois/TournoiRacketsTable.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTournoiRackets } from "../../hooks/useTournoiRackets";
import { supabase } from "../../utils/supabaseClient";
import { IconTrash, IconEdit } from "../ui/Icons";
import { paymentMeta, toCanonical } from "../../utils/payment";
import TournoiRacketForm from "./TournoiRacketForm";

export default function TournoiRacketsTable({ tournoiName, locked = false, onFinalize, onUnlock }) {
  const { rows, loading, remove, exportAllToSuivi, updateStatut, stats, revenuePaid, load, priceForRow } =
    useTournoiRackets(tournoiName);

  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const scrollRef = useRef(null);

  const [exporting, setExporting] = useState(false);
  const [statuts, setStatuts] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [payDialog, setPayDialog] = useState(null); // { row }
  const [editingRow, setEditingRow] = useState(null);
  const [allowedCordeurs, setAllowedCordeurs] = useState([]); // pour l’éditeur

  // Statuts
  useEffect(() => {
    supabase.from("statuts").select("statut_id").then(({ data, error }) => {
      if (!error) setStatuts(data || []);
    });
  }, []);

  // Cordeurs du tournoi (pour l’éditeur)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tournoi_cordeurs").select("cordeur").eq("tournoi", tournoiName);
      setAllowedCordeurs((data || []).map(d => d.cordeur));
    })();
  }, [tournoiName]);

  // Modes de paiement
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("payment_modes")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });
      if (!error) {
        const list = (data || [])
          .filter((m) => m.enabled !== false)
          .map((m) => ({
            code: m.code || (m.label ?? "").trim(),
            label: m.label || m.code || "—",
            emoji: m.emoji || "💶",
          }));
        setPaymentModes(list);
      }
    })();
  }, []);

  const statusOptions = useMemo(() => statuts.map((s) => s.statut_id), [statuts]);

  const fmtEuro = (n) =>
    `${(Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const fmtEuroCents = (cents) =>
    `${(Number(cents || 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
  const fmtDateOnly = (d) => {
    try { const dt = new Date(d); return isNaN(dt) ? "—" : dt.toLocaleDateString("fr-FR"); } catch { return "—"; }
  };

  // Export “toutes”
  const onExportAll = async () => {
    if (!confirm("Ajouter toutes les raquettes non exportées au Suivi ?")) return;
    setExporting(true);
    try {
      const res = await exportAllToSuivi();
      alert(`Export terminé (${res.inserted} ajoutées).`);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erreur export vers Suivi");
    } finally {
      setExporting(false);
    }
  };

  // Export / Ré-export (individuel)
function toISODateOnly(d) {
  if (!d) return new Date().toISOString().slice(0, 10);

  const s = String(d);

  // si c'est déjà "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // si c'est un timestamp "YYYY-MM-DDTHH:MM:SS..."
  if (s.length >= 10 && s[4] === "-" && s[7] === "-") return s.slice(0, 10);

  // fallback
  const dt = new Date(s);
  if (isNaN(dt)) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

  async function exportOne(row, { force = false } = {}) {
    const payload = {
      client_id: row.client_id ?? null,
      cordage_id: row.cordage_id ?? null,
      tension: row.tension ?? null,
      cordeur_id: row.cordeur_id ?? null,
      statut_id: row.statut_id ?? null,
      date: toISODateOnly(row.date),
      raquette: row.raquette ?? null,
      club_id: row.club_id ?? null,
      reglement_mode: row.reglement_mode ?? null,
      reglement_date: row.reglement_date ?? null,
      fourni: !!row.fourni,
      offert: !!row.offert,
      lieu_id: tournoiName,
    };
    const { error } = await supabase.from("suivi").insert([payload]);
    if (error) { alert(error.message || "Export impossible"); return; }
    if (!force && !row.exported) {
      await supabase.from("tournoi_raquettes").update({ exported: true }).eq("id", row.id);
      await load();
    }
    window.dispatchEvent(new CustomEvent("suivi:created"));
  }

  async function withScrollPreserved(fn) {
  const el = scrollRef.current;
  const top = el?.scrollTop ?? 0;
  await fn();
  requestAnimationFrame(() => {
    if (el) el.scrollTop = top;
  });
}

  // Pictos (même logique que Suivi principal)
  const U = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
  function deriveFlags(row) {
  const racket = U(row.statut_id) !== "A FAIRE";
  const isOffert =
  row.offert === true || /offert/i.test(String(row.reglement_mode || ""));

  const bill = isOffert || !!(row.reglement_mode && String(row.reglement_mode).trim());
  const msg    = !!row.contacted_at;   // ✅ COMME DANS SUIVI
  const ret    = U(row.statut_id) === "RENDU";
  return { racket, bill, msg, ret };
}
  function pickStatus(wanted) {
    const t = U(wanted);
    const hit = (statuts || []).find((s) => U(s.statut_id) === t);
    return hit ? hit.statut_id : wanted;
  }
  async function applyStatut(row, flags) {
    const { racket, bill, msg, ret } = flags;
    let newStatut = pickStatus("A FAIRE");
    if (racket) {
  if (ret) newStatut = bill ? pickStatus("RENDU") : pickStatus("A REGLER");
  else if (msg) newStatut = pickStatus("MESSAGE ENVOYE");
  else if (bill) newStatut = pickStatus("PAYE");
  else newStatut = pickStatus("A REGLER");
}

async function withScrollPreserved(fn) {
  const el = scrollRef.current;
  const top = el?.scrollTop ?? 0;
  await fn();
  requestAnimationFrame(() => {
    if (el) el.scrollTop = top;
  });
}
    await withScrollPreserved(() => updateStatut(row.id, newStatut));
  }
  async function toggleRacket(row) {
  await withScrollPreserved(async () => {
    const f = deriveFlags(row);
    await applyStatut(row, { ...f, racket: !f.racket });
    await load();
  });
}
  async function toggleReturn(row) {
    await withScrollPreserved(async () => {
    const f = deriveFlags(row);
    await applyStatut(row, { ...f, ret: !f.ret });
    await load();
  });
}
  async function toggleMessage(row) {
  await withScrollPreserved(async () => {
  const f = deriveFlags(row);

  // on met/retire contacted_at en BDD
  const nextWhen = f.msg ? null : new Date().toISOString();

  const { error } = await supabase
    .from("tournoi_raquettes")
    .update({ contacted_at: nextWhen }, { returning: "minimal" })
    .eq("id", row.id);

  if (error) {
    console.warn(error);
    alert("Maj message refusée.");
    return;
  }
  await applyStatut({ ...row, contacted_at: nextWhen }, { ...f, msg: !f.msg });
  await load();
  });
  }

// Trouve le code exact (FK/enum) à partir de ce que l'utilisateur a cliqué dans la modale
function resolvePaymentCode(raw, list) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return null;

  // match direct sur code ou label (insensible à la casse)
  const direct = list.find(pm =>
    String(pm.code || "").toLowerCase() === s ||
    String(pm.label || "").toLowerCase() === s
  );
  if (direct) return direct.code;

  // heuristique "Offert"
  if (s.startsWith("off")) {
    const off = list.find(pm =>
      /offert/i.test(String(pm.label || "")) || /offert/i.test(String(pm.code || ""))
    );
    if (off) return off.code;
  }

  return null;
}

// Mappe un clic "label" -> code EXACT autorisé par la base, sinon null
function resolvePaymentCodeStrict(raw, list) {
  const s = String(raw || "").trim();
  if (!s) return null;

  // 1) match direct code (sensible à la casse)
  let hit = list.find(pm => String(pm.code) === s);
  if (hit) return hit.code;

  // 2) match insensible à la casse sur code OU label
  const low = s.toLowerCase();
  hit = list.find(pm =>
    String(pm.code || "").toLowerCase() === low ||
    String(pm.label || "").toLowerCase() === low
  );
  if (hit) return hit.code;

  // 3) heuristique "offert"
  if (low.startsWith("off")) {
    hit = list.find(pm =>
      /offert/i.test(String(pm.label || "")) || /offert/i.test(String(pm.code || ""))
    );
    if (hit) return hit.code;
  }

  return null; // rien de strictement autorisé
}

function computeNextStatut({ racket, bill, msg, ret }) {
  if (!racket) return pickStatus("A FAIRE");
  if (ret)     return bill ? pickStatus("RENDU") : pickStatus("A REGLER");
  if (msg)     return pickStatus("MESSAGE ENVOYE");
  if (bill)    return pickStatus("PAYE");
  return pickStatus("A REGLER");
}

async function handlePickPayment(row, modePicked) {
  // feedback instantané
  setPayDialog(null);

  const s = String(modePicked || "").trim();
  const low = s.toLowerCase();

  // --- OFFERT ---
  if (low.startsWith("off")) {
    // On pose le paiement "offert" (sans reglement_mode pour respecter le CHECK)
    const patchBase = {
      offert: true,
      reglement_mode: null,
      reglement_date: new Date().toISOString(),
    };

    // calcule le prochain statut "comme si payé"
    const flags = deriveFlags({ ...row, ...patchBase, reglement_mode: null });
    const nextStatut = computeNextStatut({ ...flags, bill: true });

    // mise à jour en une seule requête
    let { error } = await supabase
      .from("tournoi_raquettes")
      .update({ ...patchBase, statut_id: nextStatut }, { returning: "minimal" })
      .eq("id", row.id);

    // fallback si colonne 'offert' n’existe pas
    if (error && /column\s+offert\s+does not exist|42703/i.test(error.message || "")) {
      const { offert, ...fallback } = patchBase;
      ({ error } = await supabase
        .from("tournoi_raquettes")
        .update({ ...fallback, statut_id: nextStatut }, { returning: "minimal" })
        .eq("id", row.id));
    }

    if (error) {
      console.error(error);
      alert("Mise à jour du règlement refusée.");
      return;
    }

    // un seul reload, non bloquant
    load();
    return;
  }

    // --- CB / Espèces / Chèque / Virement ---
  const code = resolvePaymentCodeStrict(s, paymentModes);
  if (!code) {
    const opts = paymentModes.map(pm => `${pm.label} (${pm.code})`).join(", ");
    alert(`Mode de règlement inconnu: "${modePicked}". Modes disponibles: ${opts}`);
    return;
  }

  // ✅ Mapping DB tournoi (CHECK avec accents)
  const dbMode =
    code === "Cheque" ? "Chèque" :
    code; // CB / Especes / Virement restent identiques

  const patch = {
    offert: false,
    reglement_mode: dbMode,   // ⬅️ ici
    reglement_date: new Date().toISOString(),
  };

  const flags = deriveFlags({ ...row, ...patch });
  const nextStatut = computeNextStatut({ ...flags, bill: true });

  const { error } = await supabase
    .from("tournoi_raquettes")
    .update({ ...patch, statut_id: nextStatut }, { returning: "minimal" })
    .eq("id", row.id);

  if (error) {
    if (String(error.code) === "23514") {
      const opts = paymentModes.map(pm => pm.code).join(", ");
      alert(`Mise à jour du règlement refusée (code non autorisé).\nCode envoyé: ${code}\nCodes autorisés: ${opts}`);
      return;
    }
    console.error(error);
    alert("Mise à jour du règlement refusée.");
    return;
  }

  // un seul reload, non bloquant
  load();
}

  // Ouvrir la modale paiement automatiquement si nouvelle raquette créée en PAYÉ depuis le form
  useEffect(() => {
    const onCreated = async (e) => {
      if (e?.detail?.tournoi !== tournoiName) return;
      // recharge puis cherche une ligne PAYE sans mode
      await load();
      const latest = (rowsRef.current || [])
        .filter(r => U(r.statut_id) === "PAYE" && !r.reglement_mode)
        .sort((a,b) => (+new Date(b.date) || 0) - (+new Date(a.date) || 0) || (Number(b.id)||0)-(Number(a.id)||0))[0];
      if (latest) setPayDialog({ row: latest });
    };
    window.addEventListener("tournoi:raquette:created", onCreated);
    return () => window.removeEventListener("tournoi:raquette:created", onCreated);
  }, [tournoiName, load]);

  // Gains (inchangés)
  const [showGains, setShowGains] = useState(true);
  const [gainMap, setGainMap] = useState({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("cordages").select("cordage, gain_cents");
      if (error || !alive) return;
      const map = {};
      for (const row of (data || [])) {
        const key = (row?.cordage || "").toString().trim().toUpperCase();
        if (!key) continue;
        const cents = Number.isInteger(row?.gain_cents) ? row.gain_cents : 0;
        map[key] = cents;
      }
      setGainMap(map);
    })();
    return () => { alive = false; };
  }, []);

  async function unfreezeGains() {
    if (!confirm("Défiger les gains de ce tournoi et recalculer selon Données ?")) return;
    const { error } = await supabase
      .from("tournoi_raquettes")
      .update({ gain_cents: null, gain_frozen_at: null })
      .eq("tournoi", tournoiName);
    if (error) { alert(error.message || "Échec du défige"); return; }
    await load();
    alert("Gains défigés. Le tableau reflète maintenant les tarifs actuels.");
  }

  const doneRows = (rows || []).filter(r => U(r.statut_id) !== "A FAIRE");
  const gainsByCordeur = new Map();
  for (const r of doneRows) {
    const cordageLabel = (r.cordage?.cordage || r.cordage_id || "").toString().trim().toUpperCase();
    const snapshot = Number.isFinite(r.gain_cents) ? r.gain_cents : null;
    const gainCents = snapshot ?? (gainMap[cordageLabel] ?? 0);
    const key = (r.cordeur?.cordeur || r.cordeur_id || "—").toString();
    const prev = gainsByCordeur.get(key) || { cordeur: key, count: 0, eurosCents: 0 };
    prev.count += 1;
    prev.eurosCents += gainCents;
    gainsByCordeur.set(key, prev);
  }
  const gainsCalc = Array.from(gainsByCordeur.values())
    .sort((a,b) => b.eurosCents - a.eurosCents || a.cordeur.localeCompare(b.cordeur));
  const totalGainCents = gainsCalc.reduce((sum, g) => sum + (g.eurosCents || 0), 0);

  return (
    <div className="bg-white rounded-2xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-lg font-semibold">Suivi du tournoi</div>
        <div className="flex items-center gap-2">
          <button onClick={onExportAll} disabled={exporting} className="btn-red">
            Ajouter toutes au Suivi
          </button>
        </div>
      </div>

    {/* Lignes */}
<div ref={scrollRef} className="mt-3 space-y-2">
  {loading && <div className="py-4 text-sm text-gray-600">Chargement…</div>}

  {!loading && rows.map((r) => {
    const isOffert = r.offert === true || /offert/i.test(String(r.reglement_mode || ""));
    const pay = isOffert ? { emoji: "🎁", label: "Offert" } : paymentMeta(r.reglement_mode);
    const tarif = priceForRow ? priceForRow(r) : 0;

    const flags = deriveFlags(r);
    const pill = (active) =>
      `inline-flex h-8 w-8 items-center justify-center rounded-full border transition
       ${active ? "bg-green-500 text-white border-green-600" : "bg-gray-100 text-gray-500 border-gray-200"}`;

    return (
      <div key={r.id} className="p-2 rounded-xl border bg-white flex items-start md:items-center gap-3">
        {/* Colonne principale */}
        <div className="flex-1 min-w-0">
          {/* En-tête: titre + actions mobile à droite */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm md:text-base truncate">
                {r.cordage?.cordage || r.cordage_id || "—"} {r.tension ? "• " + r.tension : ""}
              </div>

              {/* Nom • Date • Club • Cordeur */}
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-700">
                <span className="truncate">
                  {r.client ? `${r.client.nom || ""} ${r.client.prenom || ""}`.trim() : "—"}
                </span>
                <span className="text-gray-500 whitespace-nowrap">• {fmtDateOnly(r.date)}</span>
                <span className="text-gray-500 whitespace-nowrap">
                  • {String(r.club_id || "—").replace(/\s*[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim()}
                </span>
                <span className="text-gray-500 whitespace-nowrap">
                  • <span className="whitespace-nowrap">Cordeur:</span>&nbsp;
                  <span className="whitespace-nowrap">{r.cordeur?.cordeur || r.cordeur_id || "—"}</span>
                </span>
              </div>
            </div>

            {/* Actions MOBILE */}
            <div className="flex items-center gap-2 shrink-0 md:hidden">
              {!r.exported ? (
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                  title="Exporter cette raquette vers le Suivi"
                  onClick={() => exportOne(r)}
                >
                  Exporter
                </button>
              ) : (
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                  title="Ré-exporter cette raquette vers le Suivi"
                  onClick={() => exportOne(r, { force: true })}
                >
                  Ré-exporter&nbsp;?
                </button>
              )}
              <button className="icon-btn" title="Éditer" aria-label="Éditer" onClick={() => setEditingRow(r)}>
                <IconEdit />
              </button>
              <button
                className="icon-btn-red"
                onClick={() => !locked && remove(r.id)}
                title="Supprimer"
                aria-label="Supprimer"
              >
                <IconTrash />
              </button>
            </div>
          </div>

          {/* Pictos + règlement + tarif */}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button type="button" className={pill(flags.racket)} title="Fait / Pas fait" onClick={() => toggleRacket(r)}>
              <span aria-hidden>🎾</span>
            </button>
            <button type="button" className={pill(flags.bill)} title="Payé / Non payé" onClick={() => setPayDialog({ row: r })}>
              <span aria-hidden>💶</span>
            </button>
            <button type="button" className={pill(flags.msg)} title="Message envoyé / Non envoyé" onClick={() => toggleMessage(r)}>
              <span aria-hidden>💬</span>
            </button>
            <button type="button" className={pill(flags.ret)} title="Rendu / Non rendu" onClick={() => toggleReturn(r)}>
              <span aria-hidden>↩️</span>
            </button>

            <button
              type="button"
              className="ml-2 inline-flex items-center gap-2 text-sm icon-btn whitespace-nowrap"
              title="Définir / modifier le règlement"
              onClick={() => setPayDialog({ row: r })}
            >
              <span className="text-gray-600">Règlement:</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span aria-hidden>{pay.emoji}</span> {pay.label}
              </span>
            </button>

            <span className="text-sm font-medium">{fmtEuro(tarif)}</span>
          </div>
        </div>

        {/* Actions DESKTOP */}
        <div className="ml-3 hidden md:flex items-center gap-2 shrink-0">
          {!r.exported ? (
            <button
              type="button"
              className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
              title="Exporter cette raquette vers le Suivi"
              onClick={() => exportOne(r)}
            >
              Exporter
            </button>
          ) : (
            <button
              type="button"
              className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
              title="Ré-exporter cette raquette vers le Suivi"
              onClick={() => exportOne(r, { force: true })}
            >
              Ré-exporter&nbsp;?
            </button>
          )}
          <button className="icon-btn" title="Éditer" aria-label="Éditer" onClick={() => setEditingRow(r)}>
            <IconEdit />
          </button>
          <button
            className="icon-btn-red"
            onClick={() => !locked && remove(r.id)}
            title="Supprimer"
            aria-label="Supprimer"
          >
            <IconTrash />
          </button>
        </div>
      </div>
    );
  })}
</div>
      {/* Stats + panels bas */}
      <div className="mt-4 grid md:grid-cols-3 gap-2">
        <div className="rounded-xl border p-3 flex flex-col justify-between">
          <div>
            <div className="text-sm text-gray-600">Total raquettes</div>
            <div className="mt-1 text-2xl font-bold">{stats.total}</div>
          </div>

          {/* === Gain cordeur (toggle) === */}
          <div className="mt-3">
            <button
              type="button"
              className="text-sm text-gray-700 underline"
              onClick={() => setShowGains(s => !s)}
            >
              {showGains ? "Masquer le gain cordeur" : "Afficher le gain cordeur"}
            </button>

            {showGains && (
              <div className="mt-2 rounded-2xl border p-3 bg-white">
                <div className="text-sm text-gray-600 mb-2">Gain cordeur (par cordage)</div>

      {gainsCalc.length === 0 ? (
        <div className="text-sm text-gray-500">— Aucun pour l’instant</div>
      ) : (
        <>
          <ul className="text-sm space-y-1">
            {gainsCalc.map((g) => (
              <li key={g.cordeur} className="flex justify-between">
                <span>{g.cordeur}</span>
                <span>
                  <b>{g.count}</b> raq. &nbsp;|&nbsp; <b>{fmtEuroCents(g.eurosCents)}</b>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 pt-2 border-t text-sm flex justify-between font-medium">
            <span>Total</span>
            <span>{fmtEuroCents(totalGainCents)}</span>
          </div>
        </>
      )}
    </div>
  )}
</div>

          {locked ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-700 text-xs">
                ✅ Tournoi verrouillé
              </span>
              {onUnlock && (
                <button type="button" className="icon-btn" onClick={onUnlock} title="Déverrouiller">🔓</button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-red px-3 py-1 rounded-xl text-white"
                onClick={onFinalize}
                title="Figer les gains et verrouiller le tournoi"
              >
                Tournoi terminé
              </button>
              <button
                type="button"
                className="text-xs underline text-gray-600"
                onClick={unfreezeGains}
                title="Effacer les snapshots et recalculer selon Données"
              >
                Recalculer d’après Données
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-sm text-gray-600">Par cordeur</div>
          <ul className="text-sm mt-1">
            {Object.entries(stats.byCordeur).map(([k, v]) => (
              <li key={k}>{k}: <b>{v}</b></li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-sm text-gray-600">Par cordage • cordeur</div>
          <ul className="text-sm mt-1">
            {Object.entries(stats.byCordageCordeur).map(([k, v]) => (
              <li key={k}>{k}: <b>{v}</b></li>
            ))}
          </ul>
        </div>
      </div>

      {/* Modale Paiement */}
      {payDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40" onClick={() => setPayDialog(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="text-2xl leading-none">💶</div>
              <div className="flex-1">
                <div className="text-lg font-semibold">Mode de règlement</div>
                <div className="text-sm text-gray-600">Choisis le mode utilisé pour cette raquette.</div>
              </div>
              <button aria-label="Fermer" className="text-gray-500 hover:text-black" onClick={() => setPayDialog(null)}>✕</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {paymentModes.map((pm) => (
                <button
                  key={pm.code}
                  type="button"
                  onClick={() => handlePickPayment(payDialog.row, pm.code)}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl border bg-white hover:bg-gray-50 hover:shadow transition"
                >
                  <span className="text-lg">{pm.emoji || "💶"}</span>
                  <span className="font-medium">{pm.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={() => setPayDialog(null)} className="px-4 h-10 rounded-xl border text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panneau latéral Éditer (même principe que le Suivi) */}
      {editingRow && (
        <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={() => setEditingRow(null)}>
          <div className="w-full max-w-xl bg-white h-full p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <TournoiRacketForm
              tournoiName={tournoiName}
              allowedCordeurs={allowedCordeurs}
              editingId={editingRow.id}
              initialData={editingRow}
              onDone={async () => {
                setEditingRow(null);
                await load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
