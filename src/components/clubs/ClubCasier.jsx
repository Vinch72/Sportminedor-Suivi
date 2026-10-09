// src/components/clubs/ClubCasier.jsx — casier d'un club : dépôts QR en attente,
// historique, message affiché sur la page de dépôt, QR code à imprimer.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { supabase } from "../../utils/supabaseClient";
import { calcTarifSuivi, bobineUsed } from "../../utils/tarifSuivi";

const RED = "#E10600";
const LIEU_MAGASIN = "Magasin";
const STATUT_A_FAIRE = "A FAIRE";

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtEur = (v) => (v == null ? "—" : `${Number(v).toFixed(2).replace(".", ",")} €`);
const depotUrl = (token) => `${window.location.origin}/depot?c=${token}`;

const TABS = [
  { key: "pending", label: "En attente" },
  { key: "history", label: "Historique" },
  { key: "message", label: "Message" },
  { key: "qr",      label: "QR code" },
];

export default function ClubCasier({ club, clubs = [], cordages = [], pending = [], onClose, onClubUpdated }) {
  const [tab,       setTab]       = useState("pending");
  const [busyId,    setBusyId]    = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [err,       setErr]       = useState("");
  const [ok,        setOk]        = useState("");

  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const clubObj = (name) => clubs.find(c => c.clubs === name) || null;
  const cordageObj = (name) => cordages.find(c => c.cordage === name) || null;

  function priceOf(d) {
    return calcTarifSuivi({ club: clubObj(d.client_club || club.clubs), cordage: cordageObj(d.cordage_id), fourni: d.fourni });
  }

  // ── Dépôt → ligne de suivi « A FAIRE », lieu Magasin ─────────────────────
  async function convertir(d) {
    setBusyId(d.id); setErr(""); setOk("");
    try {
      const clientClub = d.client_club || club.clubs;
      const cl = clubObj(clientClub);
      const co = cordageObj(d.cordage_id);
      const tarif = calcTarifSuivi({ club: cl, cordage: co, fourni: d.fourni });
      const note = d.fourni && d.cordage_text
        ? `Cordage fourni : ${d.cordage_text}${d.notes ? `\n${d.notes}` : ""}`
        : (d.notes || null);

      const { data: ins, error } = await supabase.from("suivi").insert({
        date:         (d.date_depot || new Date().toISOString()).slice(0, 10),
        statut_id:    STATUT_A_FAIRE,
        client_id:    d.client_id || null,
        client_name:  d.client_name || null,
        client_phone: d.client_phone || null,
        club_id:      clientClub,
        lieu_id:      LIEU_MAGASIN,
        cordage_id:   d.cordage_id || null,
        cordeur_id:   null,
        couleur:      "none",
        tension:      d.tension || null,
        raquette:     d.raquette_label || null,
        raquette_id:  d.raquette_id || null,
        note,
        fourni:       !!d.fourni,
        offert:       false,
        express:      false,
        tarif:        tarif ?? null,
        bobine_used:  bobineUsed({ club: cl, cordage: co, fourni: d.fourni }),
      }).select("id").single();
      if (error) throw error;

      // Comme SuiviForm : on re-force le tarif après insertion
      await supabase.from("suivi").update({ tarif: tarif ?? null }).eq("id", ins.id);

      const { error: uErr } = await supabase.from("depot_casier")
        .update({ converted: true, converted_at: new Date().toISOString(), suivi_id: ins.id })
        .eq("id", d.id);
      if (uErr) throw uErr;

      window.dispatchEvent(new CustomEvent("suivi:created", { detail: { ids: [ins.id] } }));
      window.dispatchEvent(new CustomEvent("depot:changed"));
      setOk(`Raquette de ${d.client_name || "ce client"} ajoutée au suivi (« A FAIRE »).`);
    } catch (e) {
      setErr(e.message || "Erreur lors de l'ajout au suivi.");
    } finally { setBusyId(null); }
  }

  async function supprimer(d) {
    setBusyId(d.id); setErr(""); setOk("");
    const { error } = await supabase.from("depot_casier").delete().eq("id", d.id);
    setBusyId(null); setConfirmDel(null);
    if (error) { setErr(error.message); return; }
    window.dispatchEvent(new CustomEvent("depot:changed"));
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center modal-overlay p-3" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
        {/* En-tête */}
        <div className="px-5 py-4 bg-gray-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="font-semibold text-lg">🔐 Casier</div>
            <div className="text-sm opacity-70 truncate">{club.clubs}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 rounded hover:bg-white/10 text-white">✕</button>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 px-3 pt-3 border-b bg-gray-50 shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => { setTab(t.key); setErr(""); setOk(""); }}
              className="px-3 h-9 rounded-t-lg text-sm font-medium whitespace-nowrap transition"
              style={tab === t.key
                ? { background: "#fff", color: RED, border: "1px solid #e5e7eb", borderBottom: "1px solid #fff", marginBottom: -1 }
                : { color: "#6b7280" }}>
              {t.label}{t.key === "pending" && pending.length > 0 ? ` (${pending.length})` : ""}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {err && <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</p>}
          {ok  && <p className="mb-3 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">{ok}</p>}

          {tab === "pending" && (
            pending.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-4xl mb-2">📭</div>
                <div className="text-sm">Aucun dépôt en attente dans ce casier.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map(d => (
                  <div key={d.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">{d.client_name || "—"}</div>
                        <div className="text-xs text-gray-500">{fmtDateTime(d.date_depot)}{d.client_phone ? ` · ${d.client_phone}` : ""}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-gray-400">Prix</div>
                        <div className="font-bold" style={{ color: RED }}>{fmtEur(priceOf(d))}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                      <span>🏸 {d.raquette_label || "—"}</span>
                      <span>🧵 {d.fourni ? `Fourni${d.cordage_text ? ` : ${d.cordage_text}` : ""}` : (d.cordage_id || "—")}</span>
                      <span>⚡ {d.tension || "—"}</span>
                      {d.client_club && d.client_club !== club.clubs && <span>🛡️ {d.client_club}</span>}
                    </div>
                    {d.notes && <div className="mt-1 text-sm text-gray-500 italic">📝 {d.notes}</div>}
                    <div className="mt-3 flex justify-end gap-2">
                      {confirmDel === d.id ? (
                        <>
                          <button type="button" onClick={() => setConfirmDel(null)} className="px-3 h-9 rounded-lg text-sm border border-gray-200 text-gray-600">Annuler</button>
                          <button type="button" disabled={busyId === d.id} onClick={() => supprimer(d)} className="px-3 h-9 rounded-lg text-sm font-bold text-white bg-red-600 disabled:opacity-50">Supprimer le dépôt</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => setConfirmDel(d.id)} className="px-3 h-9 rounded-lg text-sm border border-red-200 text-red-600 hover:bg-red-50">Supprimer</button>
                          <button type="button" disabled={busyId === d.id} onClick={() => convertir(d)}
                            className="px-4 h-9 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: RED }}>
                            {busyId === d.id ? "…" : "➕ Ajouter au suivi"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "history" && <History club={club} />}
          {tab === "message" && <MessageEditor club={club} onSaved={onClubUpdated} />}
          {tab === "qr" && <QrPanel club={club} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Historique des dépôts traités ─────────────────────────────────────────── */
function History({ club }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("depot_casier")
        .select("id, client_name, raquette_label, cordage_id, cordage_text, fourni, tension, notes, date_depot, converted_at")
        .eq("club_id", club.clubs).eq("converted", true)
        .order("date_depot", { ascending: false }).limit(500);
      setRows(data || []);
      setLoading(false);
    })();
  }, [club.clubs]);

  function exportCSV() {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Date dépôt", "Client", "Raquette", "Cordage", "Tension", "Fourni", "Note", "Ajouté au suivi le"],
      ...rows.map(d => [
        new Date(d.date_depot).toLocaleString("fr-FR"), d.client_name, d.raquette_label,
        d.fourni ? (d.cordage_text || "Fourni") : d.cordage_id, d.tension, d.fourni ? "Oui" : "Non", d.notes,
        d.converted_at ? new Date(d.converted_at).toLocaleString("fr-FR") : "",
      ]),
    ].map(r => r.map(esc).join(";")).join("\n");
    const blob = new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `depots-casier-${club.clubs}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) return <div className="text-sm text-gray-400">Chargement…</div>;
  if (!rows.length) return <div className="text-center py-10 text-sm text-gray-400">Aucun dépôt traité pour l'instant.</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-500">{rows.length} dépôt(s) ajouté(s) au suivi</div>
        <button type="button" onClick={exportCSV} className="px-3 h-8 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">⬇️ Export CSV</button>
      </div>
      <div className="divide-y rounded-xl border">
        {rows.map(d => (
          <div key={d.id} className="px-3 py-2.5 text-sm flex items-center gap-3">
            <div className="w-24 shrink-0 text-xs text-gray-400">{fmtDateTime(d.date_depot)}</div>
            <div className="flex-1 min-w-0 truncate"><b>{d.client_name || "—"}</b> · {d.raquette_label || "—"}</div>
            <div className="shrink-0 text-xs text-gray-500">{d.fourni ? "Fourni" : (d.cordage_id || "—")}{d.tension ? ` · ${d.tension}` : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Message affiché sur la page de dépôt ──────────────────────────────────── */
function MessageEditor({ club, onSaved }) {
  const [msg,   setMsg]   = useState(club.notification_message || "");
  const [start, setStart] = useState(club.notification_start || "");
  const [end,   setEnd]   = useState(club.notification_end || "");
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState("");

  async function save(clear = false) {
    setSaving(true); setDone("");
    const patch = clear
      ? { notification_message: null, notification_start: null, notification_end: null }
      : { notification_message: msg.trim() || null, notification_start: start || null, notification_end: end || null };
    const { error } = await supabase.from("clubs").update(patch).eq("clubs", club.clubs);
    setSaving(false);
    if (error) { setDone("❌ " + error.message); return; }
    if (clear) { setMsg(""); setStart(""); setEnd(""); }
    setDone(clear ? "Message retiré." : "Message enregistré.");
    onSaved?.({ ...club, ...patch });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Affiché en haut de la page de dépôt de ce casier (ex. « Casier fermé pendant les vacances, dépose ta raquette au magasin »).
      </p>
      <textarea rows={3} value={msg} onChange={e => setMsg(e.target.value)}
        className="w-full border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none"
        placeholder="Ton message aux joueurs…" />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-gray-600">Afficher à partir du
          <input type="date" value={start || ""} onChange={e => setStart(e.target.value)} className="mt-1 w-full h-10 border rounded-xl px-3 text-sm" />
        </label>
        <label className="block text-sm text-gray-600">Jusqu'au (inclus)
          <input type="date" value={end || ""} onChange={e => setEnd(e.target.value)} className="mt-1 w-full h-10 border rounded-xl px-3 text-sm" />
        </label>
      </div>
      <p className="text-xs text-gray-400">Dates facultatives : sans date, le message reste affiché jusqu'à ce que tu le retires.</p>
      {done && <p className="text-sm text-gray-600">{done}</p>}
      <div className="flex justify-end gap-2">
        {club.notification_message && (
          <button type="button" disabled={saving} onClick={() => save(true)} className="px-3 h-9 rounded-lg text-sm border border-gray-200 text-gray-600">Retirer le message</button>
        )}
        <button type="button" disabled={saving} onClick={() => save(false)} className="px-4 h-9 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: RED }}>
          {saving ? "…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

/* ── QR code du casier ─────────────────────────────────────────────────────── */
function QrPanel({ club }) {
  const url = useMemo(() => (club.depot_token ? depotUrl(club.depot_token) : ""), [club.depot_token]);
  const [img, setImg] = useState("");

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 600, margin: 2, errorCorrectionLevel: "H", color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setImg).catch(() => setImg(""));
  }, [url]);

  function print() {
    const name = String(club.clubs || "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR casier ${name}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px}h1{margin:0 0 4px;font-size:28px}
      p{color:#555;margin:0 0 24px;font-size:18px}img{width:360px;height:360px}.s{margin-top:24px;font-size:14px;color:#888}</style>
      </head><body><h1>🏸 Dépose ta raquette ici</h1><p>${name} — scanne le QR code</p>
      <img src="${img}" alt="QR"/><div class="s">Sportminedor · cordage</div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  if (!url) return <div className="text-sm text-gray-400">QR indisponible (identifiant de casier manquant).</div>;

  return (
    <div className="text-center space-y-4">
      <p className="text-sm text-gray-500">À imprimer et coller sur le casier du club. Le QR reste valable même si le club est renommé.</p>
      {img ? <img src={img} alt="QR code du casier" className="mx-auto w-56 h-56 border rounded-xl" /> : <div className="text-sm text-gray-400">Génération…</div>}
      <div className="text-xs text-gray-400 break-all">{url}</div>
      <div className="flex justify-center gap-2 flex-wrap">
        <a href={img} download={`qr-casier-${club.clubs}.png`} className="px-4 h-10 inline-flex items-center rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50">⬇️ Télécharger</a>
        <button type="button" onClick={print} disabled={!img} className="px-4 h-10 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: RED }}>🖨️ Imprimer</button>
        <a href={url} target="_blank" rel="noreferrer" className="px-4 h-10 inline-flex items-center rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50">👁️ Voir la page</a>
      </div>
    </div>
  );
}
