// src/pages/PartnerPortalPage.jsx — Interface vue par le club partenaire
import { Fragment, useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../auth/AuthProvider";
import sportminedorLogo from "../assets/sportminedor-logo.png";

const STORE_ID = "sportminedor";

function getSeasonBounds() {
  const today = new Date();
  const m = today.getMonth();
  const startYear = m >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    seasonStart: `${startYear}-09-01`,
    seasonEnd:   `${startYear + 1}-08-31`,
    label:       `${startYear}/${startYear + 1}`,
  };
}

function BobineProgress({ label, count, billed }) {
  const lotsTotal   = Math.floor(count / 20);
  const enAttente   = Math.max(0, lotsTotal - billed);
  const progression = count % 20;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">🪡 Bobine {label}</span>
        <span className="text-xs text-gray-400">{count} raquette{count > 1 ? "s" : ""} cette saison</span>
      </div>

      {/* Progression vers le prochain lot */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>Prochain lot</span>
          <span className="font-semibold tabular-nums">{progression} / 20</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(progression / 20) * 100}%`, background: "#E10600" }}
          />
        </div>
      </div>

      {/* Stats lots */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-xl bg-gray-50 px-3 py-2 text-center">
          <div className="text-lg font-bold text-gray-900 tabular-nums">{billed}</div>
          <div className="text-[10px] text-gray-400">lot{billed > 1 ? "s" : ""} facturé{billed > 1 ? "s" : ""}</div>
        </div>
        <div className="flex-1 rounded-xl px-3 py-2 text-center"
          style={{ background: enAttente > 0 ? "rgba(225,6,0,0.06)" : "#f0fdf4" }}>
          <div className="text-lg font-bold tabular-nums" style={{ color: enAttente > 0 ? "#E10600" : "#16a34a" }}>{enAttente}</div>
          <div className="text-[10px]" style={{ color: enAttente > 0 ? "#E10600" : "#16a34a" }}>en attente</div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_CONFIG = {
  en_attente: { label: "En attente",  cls: "bg-yellow-100 text-yellow-800" },
  en_cours:   { label: "En cours",    cls: "bg-blue-100 text-blue-800"   },
  expedie:    { label: "Expédié",     cls: "bg-purple-100 text-purple-800" },
  livre:      { label: "Livré",       cls: "bg-green-100 text-green-800" },
  annule:     { label: "Annulé",      cls: "bg-gray-100 text-gray-500"   },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const inputCls = "w-full h-10 px-3 rounded-xl text-sm border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200";

function ConfirmModal({ title, message, confirmLabel = "Supprimer", onConfirm, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-[200]" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose} />
      <div className="fixed inset-0 z-[200] overflow-y-auto pointer-events-none">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-lg shrink-0">🗑️</div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                Annuler
              </button>
              <button type="button" onClick={async () => { await onConfirm(); onClose(); }}
                className="flex-1 h-10 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition">
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const HATCH_BG = "repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 10px)";
const STATUT_LIVR_CFG = {
  en_attente: { label: "En attente", cls: "bg-yellow-100 text-yellow-700" },
  en_cours:   { label: "En cours",   cls: "bg-blue-100 text-blue-700"   },
  expediee:   { label: "Expédiée",   cls: "bg-green-100 text-green-700" },
};
function fmtD(s) { return s ? new Date(s).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" }) : "—"; }

// ── Calendrier saison (Sept → Août) ───────────────────────────────────────────
const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAY_NAMES   = ["L","M","M","J","V","S","D"];

function MonthGrid({ month, year, today }) {
  const firstDay    = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
      <p className="text-xs font-semibold text-gray-700 text-center mb-2">
        {MONTH_NAMES[month]} <span className="text-gray-400 font-normal">{year}</span>
      </p>
      <div className="grid grid-cols-7 gap-px">
        {DAY_NAMES.map((d, i) => (
          <div key={i} className="text-[9px] text-center text-gray-400 font-medium pb-1">{d}</div>
        ))}
        {cells.map((d, i) => {
          const isToday = d && today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
          const isSun   = d && ((i) % 7 === 6);
          return (
            <div key={i} className={`text-[10px] text-center leading-5 rounded-full w-5 h-5 mx-auto ${
              isToday ? "bg-blue-600 text-white font-bold" :
              isSun   ? "text-red-400" :
              d       ? "text-gray-700" : ""
            }`}>
              {d || ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeasonCalendar() {
  const today = new Date();
  const seasonStart = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  const seasonEnd   = seasonStart + 1;

  const months = Array.from({ length: 12 }, (_, i) => {
    const monthIndex = (8 + i) % 12;
    const year = i < 4 ? seasonStart : seasonEnd;
    return { month: monthIndex, year };
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base font-bold text-gray-800">Saison {seasonStart} / {seasonEnd}</span>
        <span className="text-xs text-gray-400">Septembre → Août</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {months.map(({ month, year }) => (
          <MonthGrid key={`${year}-${month}`} month={month} year={year} today={today} />
        ))}
      </div>
    </div>
  );
}

// ── Cadencement volant (vue club, lecture seule) ──────────────────────────────
function SeasonOrderSummary({ order }) {
  if (!order?.lines?.length) return null;
  const total = order.lines.reduce((s, l) => s + (Number(l.prix_vente) || 0) * (l.quantite_totale || 0), 0);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
      <div className="bg-gray-800 text-white text-center text-xs font-bold px-4 py-2.5 tracking-wide uppercase">
        Commande saison {order.season}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 font-medium">Marque</th>
              <th className="text-left px-4 py-2 font-medium">Réf</th>
              <th className="text-right px-4 py-2 font-medium">Prix vente</th>
              <th className="text-right px-4 py-2 font-medium">Quantité</th>
              <th className="text-right px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...order.lines].sort((a, b) => (Number(a.prix_vente) || 0) - (Number(b.prix_vente) || 0)).map(l => (
              <tr key={l.id} className="border-b border-gray-50">
                <td className="px-4 py-2.5 font-medium">{l.nom_produit}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{l.ref_produit || "—"}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{l.prix_vente ? `${Number(l.prix_vente).toLocaleString("fr-FR")} €` : "—"}</td>
                <td className="px-4 py-2.5 text-right">{l.quantite_totale}</td>
                <td className="px-4 py-2.5 text-right font-medium">{l.prix_vente ? `${(Number(l.prix_vente) * l.quantite_totale).toLocaleString("fr-FR")} €` : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-200">
              <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-bold text-gray-700">TOTAL</td>
              <td className="px-4 py-2.5 text-right text-sm font-bold">{total.toLocaleString("fr-FR")} €</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function DeliveryTracker({ order, deliveries, onDemande }) {
  if (!order?.lines?.length) return null;
  const lines = order?.lines || [];
  const groups = [...lines]
    .sort((a, b) => (Number(a.prix_vente) || 0) - (Number(b.prix_vente) || 0))
    .map(line => ({
      line,
      rows: deliveries
        .filter(d => d.season_order_line_id === line.id)
        .sort((a, b) => new Date(a.date_livraison) - new Date(b.date_livraison)),
    }));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
      <div className="bg-gray-800 text-white text-xs font-bold px-4 py-2.5 tracking-wide uppercase flex items-center justify-between">
        <span>Livraisons volants — Saison {order?.season || ""}</span>
        {onDemande && (
          <button type="button" onClick={onDemande}
            className="h-7 px-3 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 transition">
            + Faire une demande
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Référence</th>
              <th className="text-right px-4 py-2 font-medium">Qté</th>
              <th className="text-left px-4 py-2 font-medium">N° Facture</th>
              <th className="text-left px-4 py-2 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ line, rows }) =>
              rows.length === 0 ? null : (
                <Fragment key={line.id}>
                  {rows.map(d => {
                    const statut = d.statut || (d.is_planned ? "en_attente" : "expediee");
                    const cfg = STATUT_LIVR_CFG[statut] || STATUT_LIVR_CFG.en_attente;
                    return (
                      <tr key={d.id} style={statut === "en_attente" ? { backgroundImage: HATCH_BG } : {}} className={statut === "en_attente" ? "text-gray-400" : ""}>
                        <td className="px-4 py-2 text-xs">{fmtD(d.date_livraison)}</td>
                        <td className="px-4 py-2">{d.nom_produit}{line.ref_produit && <span className="ml-1.5 text-xs text-gray-400">— {line.ref_produit}</span>}</td>
                        <td className="px-4 py-2 text-right">{d.quantite}</td>
                        <td className="px-4 py-2 text-xs">{d.num_facture || "—"}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center px-2 h-5 rounded-full text-[10px] font-medium ${cfg.cls}`}>{cfg.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-100">
                    <td colSpan={3} className="px-4 py-1.5 text-right text-xs font-semibold text-gray-600">Total {line.nom_produit} :</td>
                    <td className="px-4 py-1.5 text-right text-xs font-semibold">{rows.reduce((s, d) => s + d.quantite, 0)}</td>
                    <td></td>
                  </tr>
                </Fragment>
              )
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
        <p className="text-xs font-bold text-gray-600 mb-1.5">Reste à livrer :</p>
        <div className="space-y-1">
          {[...lines].sort((a, b) => (Number(a.prix_vente) || 0) - (Number(b.prix_vente) || 0)).map(line => {
            const delivered = deliveries.filter(d => d.season_order_line_id === line.id && !d.is_planned).reduce((s, d) => s + d.quantite, 0);
            const reste = line.quantite_totale - delivered;
            const dispo = line.stock_dispo || 0;
            return (
              <div key={line.id} className="flex items-center justify-between text-xs gap-2">
                <span className="text-gray-600 min-w-0 truncate">{line.nom_produit}{line.ref_produit && <span className="ml-1 text-gray-400">— {line.ref_produit}</span>}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {dispo > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-green-50 border border-green-200 text-green-700 font-medium tabular-nums">
                      🏪 {dispo}
                    </span>
                  )}
                  <span className={`font-bold tabular-nums ${reste > 0 ? "text-gray-900" : reste < 0 ? "text-red-600" : "text-green-600"}`}>{reste} restant{Math.abs(reste) > 1 ? "s" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Modal demande volant (club) ────────────────────────────────────────────────
function DemandeVolantModal({ seasonOrder, deliveries, partnerUserId, storeId, onClose, onSuccess }) {
  const cadLines = [...(seasonOrder?.lines || [])].sort((a, b) => (Number(a.prix_vente) || 0) - (Number(b.prix_vente) || 0));
  const [lineId,   setLineId]   = useState("");
  const [quantite, setQuantite] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const selectedLine = cadLines.find(l => l.id === lineId);
  const reste = lineId ? (() => {
    const line = cadLines.find(l => l.id === lineId);
    if (!line) return null;
    const livree = (deliveries || []).filter(d => d.season_order_line_id === lineId && !d.is_planned).reduce((s, d) => s + d.quantite, 0);
    return (line.quantite_totale || 0) - livree;
  })() : null;
  const dispo    = selectedLine?.stock_dispo || 0;
  const hasDispo = dispo > 0;
  const qtyNum   = parseInt(quantite) || 0;
  const pasAssezDispo  = hasDispo && qtyNum > 0 && qtyNum > dispo;
  const nonPrevu       = !hasDispo && reste !== null && qtyNum > 0 && qtyNum > reste;
  const invalidQty     = qtyNum > 0 && (qtyNum < 25 || qtyNum % 25 !== 0);
  const blocked        = pasAssezDispo || nonPrevu || invalidQty;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!lineId)   { setError("Sélectionnez un produit."); return; }
    if (!quantite) { setError("La quantité est obligatoire."); return; }
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.from("partner_deliveries").insert({
        store_id:             storeId,
        partner_user_id:      partnerUserId,
        season_order_line_id: lineId,
        nom_produit:          selectedLine.nom_produit,
        date_livraison:       new Date().toISOString().slice(0, 10),
        quantite:             qtyNum,
        is_planned:           true,
        statut:               "en_attente",
      });
      if (err) throw err;
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
        <div className="flex min-h-full items-start justify-center p-4 pt-24">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">🏸 Faire une demande</h2>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
            </div>
            {cadLines.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Aucun produit dans votre cadencement.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Produit *</label>
                  <select value={lineId} onChange={e => { setLineId(e.target.value); setQuantite(""); }} className={inputCls}>
                    <option value="">— Choisir —</option>
                    {cadLines.map(l => {
                      const livree = (deliveries || []).filter(d => d.season_order_line_id === l.id && !d.is_planned).reduce((s, d) => s + d.quantite, 0);
                      const r = (l.quantite_totale || 0) - livree;
                      const d = l.stock_dispo || 0;
                      return <option key={l.id} value={l.id}>{l.nom_produit}{l.ref_produit ? ` — ${l.ref_produit}` : ""}  ·  dispo : {d > 0 ? d : "—"}  ·  reste : {r}</option>;
                    })}
                  </select>
                </div>

                {selectedLine && (
                  <div className="flex gap-3 bg-gray-50 rounded-xl px-3 py-2.5 text-xs">
                    <div className="flex-1">
                      <span className="text-gray-400">Cadencement restant</span>
                      <p className="font-bold text-gray-900 tabular-nums">{reste ?? "—"}</p>
                    </div>
                    <div className="w-px bg-gray-200" />
                    <div className="flex-1">
                      <span className="text-gray-400">Dispo en magasin</span>
                      <p className={`font-bold tabular-nums ${hasDispo ? "text-green-600" : "text-gray-400"}`}>{hasDispo ? dispo : "Non renseigné"}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantité * <span className="text-gray-400 font-normal">(par tranches de 25 — min. 25)</span></label>
                  <input type="number" min="25" step="25" max={hasDispo ? dispo : (reste ?? undefined)} value={quantite} onChange={e => setQuantite(e.target.value)} placeholder="ex. 50" className={inputCls} />
                  {qtyNum > 0 && qtyNum % 25 !== 0 && (
                    <p className="text-xs text-red-500 mt-1">La quantité doit être un multiple de 25 (25, 50, 75…).</p>
                  )}
                  {qtyNum > 0 && qtyNum < 25 && qtyNum % 25 === 0 && (
                    <p className="text-xs text-red-500 mt-1">Quantité minimum : 25 (demi-carton).</p>
                  )}
                </div>

                {pasAssezDispo && (
                  <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <span className="shrink-0">🚫</span>
                    <p className="text-xs text-red-700 leading-snug">Pas assez de disponibilité en magasin pour votre demande ({dispo} disponible{dispo > 1 ? "s" : ""}). Merci de vous rapprocher de votre interlocuteur.</p>
                  </div>
                )}
                {nonPrevu && (
                  <div className="flex gap-2 items-start bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                    <span className="shrink-0">⚠️</span>
                    <p className="text-xs text-orange-700 leading-snug">La quantité demandée ({qtyNum}) n'est pas prévue dans votre cadencement (reste : {reste}). Merci de vous rapprocher de votre interlocuteur.</p>
                  </div>
                )}
                {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
                  <button type="submit" disabled={loading || blocked}
                    className="flex-1 h-10 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "#E10600" }}>
                    {loading ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Modal commande (textile ou volants) ───────────────────────────────────────
function OrderModal({ type, catalogItems, partnerUserId, storeId, seasonOrder, deliveries, initialOrder, onClose, onSuccess }) {
  const isEdit    = !!initialOrder;
  const isTextile = type === "textile";
  const cadLines  = seasonOrder?.lines || [];

  const findCatalogItem = (name) => catalogItems.find(c => c.name === name) || null;
  const initItem = isEdit ? findCatalogItem(initialOrder.details?.article) : null;

  const [selectedItem,      setSelectedItem]      = useState(initItem?.id || null);
  const [taille,            setTaille]            = useState(isEdit ? (initialOrder.details?.taille  || "") : "");
  const [couleur,           setCouleur]           = useState(isEdit ? (initialOrder.details?.couleur || "") : "");
  const [vitesse,           setVitesse]           = useState(isEdit ? (initialOrder.details?.vitesse || "") : "");
  const [quantite,          setQuantite]          = useState(isEdit ? (initialOrder.details?.quantite || "") : "");
  const [notes,             setNotes]             = useState(isEdit ? (initialOrder.notes || "") : "");
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState("");
  const [previewImg,        setPreviewImg]        = useState(null);
  const [cadencementLineId, setCadencementLineId] = useState("");

  const item = catalogItems.find(c => c.id === selectedItem);

  const resteParLigne = (lineId) => {
    const line = cadLines.find(l => l.id === lineId);
    if (!line) return null;
    const livree = (deliveries || [])
      .filter(d => d.season_order_line_id === lineId && !d.is_planned)
      .reduce((s, d) => s + (d.quantite || 0), 0);
    const planifie = (deliveries || [])
      .filter(d => d.season_order_line_id === lineId && d.is_planned && d.partner_order_id !== initialOrder?.id)
      .reduce((s, d) => s + (d.quantite || 0), 0);
    return (line.quantite_totale || 0) - livree - planifie;
  };

  const selectedCadLine = cadLines.find(l => l.id === cadencementLineId);
  const resteSelected   = cadencementLineId ? resteParLigne(cadencementLineId) : null;
  const qtyNum          = parseInt(quantite) || 0;
  const depasse         = resteSelected !== null && qtyNum > 0 && qtyNum > resteSelected;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedItem) { setError("Sélectionnez un article."); return; }
    if (!quantite)     { setError("La quantité est obligatoire."); return; }
    setLoading(true); setError("");

    try {
      const details = isTextile
        ? { article: item.name, ...(taille  ? { taille }  : {}), ...(couleur ? { couleur } : {}), quantite }
        : { article: item.name, ...(vitesse ? { vitesse }  : {}), quantite };

      let orderId = initialOrder?.id;

      if (isEdit) {
        const { error: err } = await supabase.from("partner_orders")
          .update({ details, notes: notes.trim() || null })
          .eq("id", orderId);
        if (err) throw err;
      } else {
        const { data: inserted, error: err } = await supabase.from("partner_orders").insert({
          store_id:        storeId,
          partner_user_id: partnerUserId,
          type,
          status:          "en_attente",
          details,
          notes:           notes.trim() || null,
        }).select("id").single();
        if (err) throw err;
        orderId = inserted.id;

        await supabase.from("partner_notifications").insert({
          store_id:        storeId,
          partner_user_id: partnerUserId,
          message: `Nouvelle commande ${type} : ${item.name} ×${quantite}`,
          read:    false,
        });
      }

      if (!isTextile) {
        await supabase.from("partner_deliveries").delete().eq("partner_order_id", orderId);
        if (cadencementLineId && selectedCadLine) {
          await supabase.from("partner_deliveries").insert({
            store_id:             storeId,
            partner_user_id:      partnerUserId,
            season_order_line_id: cadencementLineId,
            partner_order_id:     orderId,
            nom_produit:          selectedCadLine.nom_produit,
            date_livraison:       new Date().toISOString().slice(0, 10),
            quantite:             qtyNum,
            is_planned:           true,
          });
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
        <div className="flex min-h-full items-start justify-center p-4 pt-16">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md my-4 p-6 overflow-hidden" onClick={e => e.stopPropagation()}>
        {previewImg && (
          <div className="absolute inset-0 z-10 bg-white rounded-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
              <span className="text-sm font-medium text-gray-700">{previewImg.alt}</span>
              <button type="button" onClick={() => setPreviewImg(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <img src={previewImg.url} alt={previewImg.alt} className="max-w-full max-h-[60vh] object-contain rounded-xl" />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">{isEdit ? "✏️ Modifier la commande" : isTextile ? "👕 Commande textile" : "🏸 Commande de volants"}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
        </div>

        {catalogItems.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">Aucun article disponible pour le moment.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Article *</label>
              <div className="space-y-2">
                {catalogItems.map(c => (
                  <button key={c.id} type="button" onClick={() => { setSelectedItem(c.id); setTaille(""); setCouleur(""); setVitesse(""); }}
                    className={`w-full text-left rounded-xl border text-sm transition overflow-hidden ${
                      selectedItem === c.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}>
                    <div className="flex items-center gap-3 p-3">
                      {c.image_url && (
                        <div className="shrink-0 relative group">
                          <img src={c.image_url} alt={c.name} className="w-16 h-16 object-cover rounded-lg" />
                          <button type="button"
                            onClick={e => { e.stopPropagation(); setPreviewImg({ url: c.image_url, alt: c.name }); }}
                            className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover:bg-black/30 transition">
                            <span className="text-white opacity-0 group-hover:opacity-100 text-lg transition">🔍</span>
                          </button>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">{c.name}</div>
                        {c.details?.prix && <div className="text-xs text-gray-400 mt-0.5">{Number(c.details.prix).toLocaleString("fr-FR")} €</div>}
                        {c.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{c.description}</div>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {item && isTextile && (
              <>
                {item.details?.tailles?.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Taille</label>
                    <div className="flex flex-wrap gap-2">
                      {item.details.tailles.map(t => (
                        <button key={t} type="button" onClick={() => setTaille(t)}
                          className={`h-8 px-3 rounded-lg text-xs font-medium border transition ${
                            taille === t ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
                {item.details?.couleurs?.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Couleur</label>
                    <select value={couleur} onChange={e => setCouleur(e.target.value)} className={inputCls}>
                      <option value="">— Choisir —</option>
                      {item.details.couleurs.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            {item && !isTextile && item.details?.vitesses?.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Vitesse</label>
                <div className="flex gap-2">
                  {item.details.vitesses.map(v => (
                    <button key={v} type="button" onClick={() => setVitesse(String(v))}
                      className={`h-8 w-10 rounded-lg text-xs font-medium border transition ${
                        vitesse === String(v) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>{v}</button>
                  ))}
                </div>
              </div>
            )}

            {item && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Quantité {isTextile ? "" : "(cartons)"} *
                  </label>
                  <input type="number" min="1" value={quantite} onChange={e => setQuantite(e.target.value)} placeholder="1" className={inputCls} />
                </div>

                {!isTextile && cadLines.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lier au cadencement <span className="text-gray-400">(optionnel)</span></label>
                    <select value={cadencementLineId} onChange={e => setCadencementLineId(e.target.value)} className={inputCls}>
                      <option value="">— Choisir un produit —</option>
                      {[...cadLines].sort((a, b) => (Number(a.prix_vente) || 0) - (Number(b.prix_vente) || 0)).map(l => {
                        const r = resteParLigne(l.id);
                        return (
                          <option key={l.id} value={l.id}>
                            {l.nom_produit}{l.ref_produit ? ` — ${l.ref_produit}` : ""} · reste : {r}
                          </option>
                        );
                      })}
                    </select>
                    {depasse && (
                      <div className="mt-2 flex gap-2 items-start bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                        <span className="text-orange-500 text-base shrink-0">⚠️</span>
                        <p className="text-xs text-orange-700 leading-snug">
                          La quantité commandée dépasse le stock prévu dans votre cadencement, merci de vous rapprocher de votre interlocuteur.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400">(optionnel)</span></label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                    placeholder="Informations supplémentaires…" />
                </div>
              </>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button type="submit" disabled={loading || !selectedItem}
                className="flex-1 h-10 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "#E10600" }}>
                {loading ? "Enregistrement…" : isEdit ? "Enregistrer" : "Envoyer la commande"}
              </button>
            </div>
          </form>
        )}
      </div>
        </div>
      </div>
    </>
  );
}

// ── Page portail club ─────────────────────────────────────────────────────────
export default function PartnerPortalPage() {
  const { user, signOut } = useAuth();
  const previewId = new URLSearchParams(window.location.search).get("preview");
  const isPreview = !!previewId;

  const [partnerUser,  setPartnerUser]  = useState(null);
  const [orders,       setOrders]       = useState([]);
  const [catalog,      setCatalog]      = useState([]);
  const [seasonOrder,  setSeasonOrder]  = useState(null);
  const [deliveries,   setDeliveries]   = useState([]);
  const [clubData,     setClubData]     = useState(null);
  const [bobineStats,  setBobineStats]  = useState({ base: 0, spec: 0 });
  const [bobineRows,   setBobineRows]   = useState([]);
  const [openLots,     setOpenLots]     = useState({});
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState("volants");
  const [modal,        setModal]        = useState(null);
  const [editOrder,    setEditOrder]    = useState(null);
  const [showDemande,    setShowDemande]    = useState(false);
  const [notifCount,     setNotifCount]     = useState(0);
  const [confirmDelete,  setConfirmDelete]  = useState(null);

  const load = useCallback(async () => {
    if (!isPreview && !user?.id) return;
    setLoading(true);

    const { data: pu } = isPreview
      ? await supabase.from("partner_users").select("*").eq("id", previewId).maybeSingle()
      : await supabase.from("partner_users").select("*").eq("user_id", user.id).maybeSingle();
    setPartnerUser(pu);

    if (pu) {
      const today = new Date();
      const seasonStart = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
      const season = `${seasonStart}-${seasonStart + 1}`;

      const [{ data: ords }, { data: cat }, { data: so }, { data: delivs }, { data: notifs }] = await Promise.all([
        supabase.from("partner_orders").select("*").eq("partner_user_id", pu.id).order("created_at", { ascending: false }),
        supabase.from("partner_catalog").select("*").eq("store_id", STORE_ID).eq("active", true).order("created_at", { ascending: false }),
        supabase.from("partner_season_orders")
          .select("*, lines:partner_season_order_lines(*)")
          .eq("partner_user_id", pu.id).eq("season", season).maybeSingle(),
        supabase.from("partner_deliveries")
          .select("*").eq("partner_user_id", pu.id).order("date_livraison", { ascending: true }),
        supabase.from("partner_notifications").select("id").eq("partner_user_id", pu.id).eq("read", false),
      ]);
      setOrders(ords || []);
      setCatalog(cat || []);
      setSeasonOrder(so || null);
      setDeliveries(delivs || []);
      setNotifCount((notifs || []).length);

      // Données bobine si un club est associé
      if (pu.club_id) {
        const { data: club } = await supabase.from("clubs")
          .select("clubs, bobine_base, bobine_specific, billed_base_batches, billed_spec_batches")
          .eq("clubs", pu.club_id).maybeSingle();
        setClubData(club || null);

        if (club && (club.bobine_base || club.bobine_specific)) {
          const { seasonStart, seasonEnd } = getSeasonBounds();
          const { data: rows, error: rowsErr } = await supabase
            .from("suivi")
            .select("id, date, lieu_id, cordage_id, raquette, bobine_used, client_name")
            .eq("club_id", pu.club_id)
            .in("bobine_used", ["base", "specific"])
            .gte("date", seasonStart)
            .lte("date", seasonEnd)
            .order("date", { ascending: false });
          if (rowsErr) console.error("suivi bobine error:", rowsErr);

          const allRows = rows || [];
          setBobineRows(allRows);
          setBobineStats({
            base: allRows.filter(r => r.bobine_used === "base").length,
            spec: allRows.filter(r => r.bobine_used === "specific").length,
          });
        }
      }
    }
    setLoading(false);
  }, [user?.id, previewId, isPreview]);

  useEffect(() => { load(); }, [load]);

  const filteredOrders  = orders.filter(o => o.type === tab);
  const filteredCatalog = catalog.filter(c => c.type === tab);
  const hasBobine = !!(clubData?.bobine_base || clubData?.bobine_specific);
  const { label: seasonLabel } = getSeasonBounds();

  const TAB_CLS = (active) => [
    "flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium transition whitespace-nowrap flex-1 justify-center",
    active ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
  ].join(" ");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Bannière aperçu admin */}
      {isPreview && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 text-xs font-medium text-amber-800"
          style={{ background: "#fef3c7", borderBottom: "1px solid #fde68a" }}>
          <span>👁 Mode aperçu admin — Vue du club <strong>{partnerUser?.club_name || "…"}</strong></span>
          <button type="button" onClick={() => window.close()}
            className="h-7 px-3 rounded-lg border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 transition">
            ✕ Fermer
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky z-10" style={{ top: isPreview ? 37 : 0 }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={sportminedorLogo} alt="Sportminedor" className="h-8 w-8 rounded-full object-contain" />
            <div>
              <p className="font-bold text-sm text-gray-900 leading-tight">Espace partenaire</p>
              <p className="text-xs text-gray-400">
                {isPreview ? (partnerUser?.club_name || "…") : (user?.user_metadata?.club_name || "Mon club")}
              </p>
            </div>
          </div>
          {!isPreview && (
            <button type="button" onClick={signOut}
              className="h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition">
              Déconnexion
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {loading && <p className="text-sm text-gray-500">Chargement…</p>}

        {!loading && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-full overflow-x-auto">
              <button type="button" className={TAB_CLS(tab === "volants")} onClick={async () => {
                setTab("volants");
                if (notifCount > 0 && partnerUser?.id) {
                  await supabase.from("partner_notifications").update({ read: true }).eq("partner_user_id", partnerUser.id).eq("read", false);
                  setNotifCount(0);
                }
              }}>
                <span>🏸</span> Cadencement volant
                {notifCount > 0 && tab !== "volants" && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold">{notifCount}</span>
                )}
              </button>
              <button type="button" className={TAB_CLS(tab === "textile")} onClick={() => setTab("textile")}>
                <span>👕</span> Textile
              </button>
              {hasBobine && (
                <button type="button" className={TAB_CLS(tab === "bobine")} onClick={() => setTab("bobine")}>
                  <span>🪡</span> Bobine club
                </button>
              )}
              <button type="button" className={TAB_CLS(tab === "dotation")} onClick={() => setTab("dotation")}>
                <span>🎁</span> Dotation Sportminedor
              </button>
              <button type="button" className={TAB_CLS(tab === "stands")} onClick={() => setTab("stands")}>
                <span>🏪</span> Stands
              </button>
            </div>

            {/* Bobine club */}
            {tab === "bobine" && hasBobine && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">Bobine club</h2>
                  <span className="text-xs text-gray-400">Saison {seasonLabel}</span>
                </div>

                {/* Cartes de progression */}
                {clubData.bobine_base && (
                  <BobineProgress
                    label="base"
                    count={bobineStats.base}
                    billed={clubData.billed_base_batches ?? 0}
                  />
                )}
                {clubData.bobine_specific && (
                  <BobineProgress
                    label="spécifique"
                    count={bobineStats.spec}
                    billed={clubData.billed_spec_batches ?? 0}
                  />
                )}

                {/* Lots collapsibles */}
                {bobineRows.length > 0 && (() => {
                  const types = [];
                  if (clubData.bobine_base     && bobineRows.some(r => r.bobine_used === "base"))     types.push("base");
                  if (clubData.bobine_specific && bobineRows.some(r => r.bobine_used === "specific")) types.push("specific");

                  return types.map(type => {
                    // Trier du plus ancien au plus récent pour numéroter les lots dans l'ordre
                    const rows = [...bobineRows.filter(r => r.bobine_used === type)]
                      .sort((a, b) => new Date(a.date) - new Date(b.date));

                    // Découper en lots de 20
                    const lots = [];
                    for (let i = 0; i < rows.length; i += 20) lots.push(rows.slice(i, i + 20));

                    return (
                      <div key={type} className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          🪡 Bobine {type === "base" ? "base" : "spécifique"} — {rows.length} raquette{rows.length > 1 ? "s" : ""}
                        </p>
                        {lots.map((lot, lotIdx) => {
                          const lotNum    = lotIdx + 1;
                          const isLast    = lotIdx === lots.length - 1;
                          const isComplet = lot.length === 20;
                          const key       = `${type}-${lotIdx}`;
                          // Dernier lot ouvert par défaut, les autres fermés
                          const isOpen    = openLots[key] ?? isLast;

                          return (
                            <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                              {/* Header cliquable */}
                              <button
                                type="button"
                                onClick={() => setOpenLots(p => ({ ...p, [key]: !isOpen }))}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-bold text-gray-900">Bobine {lotNum}</span>
                                  {isLast && !isComplet ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">
                                      En cours — {lot.length}/20
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                                      Complète ✓
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <span>{lot.length} raquette{lot.length > 1 ? "s" : ""}</span>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                    className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                                    <path d="M6 9l6 6 6-6" />
                                  </svg>
                                </div>
                              </button>

                              {/* Contenu dépliable */}
                              {isOpen && (
                                <div className="overflow-x-auto border-t border-gray-100">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                                        <th className="text-left px-4 py-2 font-medium">#</th>
                                        <th className="text-left px-4 py-2 font-medium">Date</th>
                                        <th className="text-left px-4 py-2 font-medium">Joueur</th>
                                        <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Lieu</th>
                                        <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Cordage</th>
                                        <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Raquette</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {lot.map((r, i) => {
                                        const joueur = r.client_name || "—";
                                        const date   = r.date
                                          ? new Date(r.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
                                          : "—";
                                        return (
                                          <tr key={r.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                                            <td className="px-4 py-2.5 text-xs text-gray-400 tabular-nums">{lotIdx * 20 + i + 1}</td>
                                            <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{date}</td>
                                            <td className="px-4 py-2.5 font-medium text-gray-900">{joueur}</td>
                                            <td className="px-4 py-2.5 text-xs text-gray-500 hidden sm:table-cell">{r.lieu_id || "—"}</td>
                                            <td className="px-4 py-2.5 text-xs text-gray-500 hidden sm:table-cell">{r.cordage_id || "—"}</td>
                                            <td className="px-4 py-2.5 text-xs text-gray-400 hidden md:table-cell">{r.raquette || "—"}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}

                <p className="text-xs text-gray-400 text-center">
                  Un lot = 20 raquettes cordées. La facturation est gérée par Sportminedor.
                </p>
              </div>
            )}

            {tab === "dotation" && (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <div className="text-3xl mb-3">🎁</div>
                <p className="font-medium text-gray-600">Dotation Sportminedor</p>
                <p className="text-sm text-gray-400 mt-1">Contenu à venir.</p>
              </div>
            )}
            {tab === "stands" && (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <div className="text-3xl mb-3">🏪</div>
                <p className="font-medium text-gray-600">Stands</p>
                <p className="text-sm text-gray-400 mt-1">Contenu à venir.</p>
              </div>
            )}

            {tab === "volants" && (
              <>
                <SeasonOrderSummary order={seasonOrder} />
                <DeliveryTracker order={seasonOrder} deliveries={deliveries} onDemande={() => setShowDemande(true)} />
              </>
            )}

            {tab === "textile" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800">Mes demandes textile</h2>
                  <button type="button" onClick={() => setModal("textile")}
                    className="h-9 px-4 rounded-xl text-sm font-bold text-white flex items-center gap-1.5"
                    style={{ background: "#E10600" }}>
                    + Faire une demande
                  </button>
                </div>
                {filteredOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                    <div className="text-3xl mb-3">👕</div>
                    <p className="font-medium text-gray-600">Aucune demande</p>
                    <p className="text-sm text-gray-400 mt-1">Cliquez sur "+ Faire une demande" pour en passer une.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredOrders.map(order => {
                      const d = order.details || {};
                      const summary = [d.article, d.taille, d.couleur, d.vitesse ? `v.${d.vitesse}` : null, d.quantite ? `×${d.quantite}` : null]
                        .filter(Boolean).join(" · ");
                      const canEdit = order.status === "en_attente";
                      return (
                        <div key={order.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{summary || "Demande"}</p>
                            {order.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{order.notes}</p>}
                            <p className="text-xs text-gray-300 mt-0.5">{fmtDate(order.created_at)}</p>
                          </div>
                          <StatusBadge status={order.status} />
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" onClick={() => setEditOrder(order)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition text-sm">✏️</button>
                              <button type="button" onClick={() => setConfirmDelete(order)}
                                className="h-7 px-2.5 rounded-lg border border-red-100 text-red-500 text-xs hover:bg-red-50 transition">Supprimer</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Supprimer la commande"
          message="Voulez-vous vraiment supprimer cette commande ? Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={async () => { await supabase.from("partner_orders").delete().eq("id", confirmDelete.id); load(); }}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {showDemande && (
        <DemandeVolantModal
          seasonOrder={seasonOrder}
          deliveries={deliveries}
          partnerUserId={partnerUser?.id}
          storeId={STORE_ID}
          onClose={() => setShowDemande(false)}
          onSuccess={load}
        />
      )}

      {modal && (
        <OrderModal
          type={modal}
          catalogItems={filteredCatalog}
          partnerUserId={partnerUser?.id}
          storeId={STORE_ID}
          seasonOrder={seasonOrder}
          deliveries={deliveries}
          onClose={() => setModal(null)}
          onSuccess={load}
        />
      )}

      {editOrder && (
        <OrderModal
          type={editOrder.type}
          catalogItems={catalog.filter(c => c.type === editOrder.type && c.active)}
          partnerUserId={partnerUser?.id}
          storeId={STORE_ID}
          seasonOrder={seasonOrder}
          deliveries={deliveries}
          initialOrder={editOrder}
          onClose={() => setEditOrder(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
