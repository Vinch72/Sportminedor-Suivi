// src/components/tournois/TournoiVentes.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { IconEdit, IconTrash } from "../ui/Icons";

const TYPES = [
  { value: "raquette",   label: "Raquette",   emoji: "🏸", remise: 20 },
  { value: "textile",    label: "Textile",    emoji: "👕", remise: 20 },
  { value: "chaussures", label: "Chaussures", emoji: "👟", remise: 20 },
  { value: "bagagerie",  label: "Bagagerie",  emoji: "🧳", remise: 15 },
  { value: "accessoire", label: "Accessoire", emoji: "🎒", remise: 10 },
  { value: "volant",     label: "Volant",     emoji: "🪶", remise: 0  },
];
const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.value, t]));

const euro = (cents) =>
  `${(Number(cents || 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const EMPTY_FORM = {
  type_produit: "raquette", nom_produit: "", couleur: "", taille: "",
  prix_unitaire_cents: "", remise_pct: "20", quantite: "1", reglement_mode: "",
  notes: "", vente_groupe_id: null,
};

function computeFinal(prixStr, remiseStr, qtStr, reglementMode) {
  if (String(reglementMode || "").toLowerCase().includes("offert")) return 0;
  const prix   = parseFloat(String(prixStr  || "0").replace(",", ".")) || 0;
  const remise = parseFloat(String(remiseStr || "0").replace(",", ".")) || 0;
  const qt     = parseInt(String(qtStr || "1"), 10) || 1;
  return Math.round(prix * (1 - remise / 100) * qt * 100);
}

function prixUnitaireFromCents(c) {
  return c ? (Number(c) / 100).toFixed(2) : "";
}

// ── Sélecteur règlement par emojis ──
function ReglementPicker({ value, onChange, paymentModes }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange("")}
        className={`h-9 px-2.5 rounded-xl border text-sm font-medium transition ${
          !value ? "text-white border-[#E10600]" : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
        }`}
        style={!value ? { backgroundColor: "#E10600" } : {}}
        title="À régler"
      >
        —
      </button>
      {paymentModes.map((pm) => (
        <button
          key={pm.code}
          type="button"
          onClick={() => onChange(pm.code)}
          className={`h-9 w-9 rounded-xl border text-lg transition ${
            value === pm.code ? "text-white border-[#E10600]" : "bg-white border-gray-300 hover:bg-gray-50"
          }`}
          style={value === pm.code ? { backgroundColor: "#E10600" } : {}}
          title={pm.label}
        >
          {pm.emoji}
        </button>
      ))}
    </div>
  );
}

// ── Affichage règlement d'une ligne ──
function ReglementBadge({ mode, paymentModes }) {
  if (!mode) return <span className="text-gray-400 text-xs">—</span>;
  const pm = paymentModes.find((p) => p.code === mode);
  return (
    <span className="text-base" title={pm?.label || mode}>
      {pm?.emoji || mode}
    </span>
  );
}

function NoteText({ text }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 60;
  return (
    <div className="text-xs text-blue-600">
      📝 {isLong && !expanded ? `${text.slice(0, 60)}…` : text}
      {isLong && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className="ml-1 underline text-blue-400 hover:text-blue-600"
        >
          {expanded ? "moins" : "plus"}
        </button>
      )}
    </div>
  );
}

// ── Ligne individuelle desktop ──
function VenteLigne({ v, onEdit, onDelete, paymentModes }) {
  const t = TYPE_MAP[v.type_produit] || { emoji: "📦", label: v.type_produit };
  return (
    <div
      className="grid items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-transparent hover:bg-white hover:border-[#E10600] hover:shadow transition text-sm"
      style={{ gridTemplateColumns: "2fr 1fr 80px 80px 70px 90px 48px 48px" }}
    >
      <div className="min-w-0">
        <div className="font-semibold truncate"><span className="mr-1">{t.emoji}</span>{v.nom_produit}</div>
        {(v.couleur || v.taille) && <div className="text-xs text-gray-400 truncate">{[v.couleur, v.taille].filter(Boolean).join(" • ")}</div>}
        {v.notes && <NoteText text={v.notes} />}
      </div>
      <span className="truncate text-gray-600">{t.label}</span>
      <span className="text-right">{euro(v.prix_unitaire_cents)}</span>
      <span className="text-right text-orange-600">{v.remise_pct > 0 ? `-${v.remise_pct}%` : "—"}</span>
      <span className="text-center font-semibold">{v.quantite}</span>
      <span className="text-right font-bold text-gray-900">{euro(v.prix_final_cents)}</span>
      <span className="text-center"><ReglementBadge mode={v.reglement_mode} paymentModes={paymentModes} /></span>
      <div className="flex items-center justify-end gap-1">
        <button className="icon-btn" title="Éditer" onClick={() => onEdit(v)}><IconEdit /></button>
        <button className="icon-btn-red" title="Supprimer" onClick={() => onDelete(v)}><IconTrash /></button>
      </div>
    </div>
  );
}

// ── Ligne mobile ──
function VenteLigneMobile({ v, onEdit, onDelete, paymentModes }) {
  const t = TYPE_MAP[v.type_produit] || { emoji: "📦", label: v.type_produit };
  const pm = paymentModes.find((p) => p.code === v.reglement_mode);
  return (
    <div className="p-3 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t.emoji} {t.label}</span>
          </div>
          <div className="font-semibold truncate">{v.nom_produit}</div>
          {(v.couleur || v.taille) && <div className="text-xs text-gray-400">{[v.couleur, v.taille].filter(Boolean).join(" • ")}</div>}
          {v.notes && <NoteText text={v.notes} />}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-bold text-gray-900">{euro(v.prix_final_cents)}</div>
          {v.remise_pct > 0 && <div className="text-xs text-orange-500">-{v.remise_pct}% sur {euro(v.prix_unitaire_cents)}</div>}
          {pm && <div className="text-lg mt-0.5" title={pm.label}>{pm.emoji}</div>}
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Qté : <b className="text-gray-900">{v.quantite}</b></span>
        <div className="flex gap-1">
          <button className="icon-btn" onClick={() => onEdit(v)}><IconEdit /></button>
          <button className="icon-btn-red" onClick={() => onDelete(v)}><IconTrash /></button>
        </div>
      </div>
    </div>
  );
}

// ── Groupe de ventes ──
function VenteGroupe({ groupe, onEdit, onDelete, onAddArticle, isSmall, paymentModes }) {
  const total = groupe.reduce((s, v) => s + (Number(v.prix_final_cents) || 0), 0);
  const groupeId = groupe[0].vente_groupe_id || groupe[0].id;

  // Modes de règlement distincts du groupe
  const modes = [...new Set(groupe.map((v) => v.reglement_mode).filter(Boolean))];

  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm">
      {/* Header groupe */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vente #{groupeId}</span>
          {modes.map((m) => {
            const pm = paymentModes.find((p) => p.code === m);
            return pm ? (
              <span key={m} className="text-base" title={pm.label}>{pm.emoji}</span>
            ) : (
              <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-white border text-gray-600">{m}</span>
            );
          })}
          <span className="text-xs text-gray-400">{groupe.length} article{groupe.length > 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-base" style={{ color: "#E10600" }}>{euro(total)}</span>
          <button
            onClick={() => onAddArticle(groupeId)}
            className="text-xs px-3 h-7 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-[#E10600] hover:text-[#E10600] transition"
          >
            + article
          </button>
        </div>
      </div>

      {/* Lignes */}
      <div className="bg-white">
        {isSmall ? (
          <div className="divide-y">
            {groupe.map((v) => (
              <VenteLigneMobile key={v.id} v={v} onEdit={onEdit} onDelete={onDelete} paymentModes={paymentModes} />
            ))}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <div
              className="grid gap-2 px-3 py-1 text-xs uppercase tracking-wider text-gray-400"
              style={{ gridTemplateColumns: "2fr 1fr 80px 80px 70px 90px 48px 48px" }}
            >
              <span>Produit</span><span>Type</span>
              <span className="text-right">PU</span><span className="text-right">Remise</span>
              <span className="text-center">Qté</span><span className="text-right">Total</span>
              <span className="text-center">💶</span><span></span>
            </div>
            {groupe.map((v) => (
              <VenteLigne key={v.id} v={v} onEdit={onEdit} onDelete={onDelete} paymentModes={paymentModes} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TournoiVentes({ tournoiName }) {
  const [ventes, setVentes]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const [paymentModes, setPaymentModes] = useState([]);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [editingId, setEditingId]       = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [saving, setSaving]             = useState(false);
  const [isSmall, setIsSmall]           = useState(window.innerWidth < 768);

  useEffect(() => {
    const fn = () => setIsSmall(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const load = useCallback(async () => {
    if (!tournoiName) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tournoi_ventes").select("*").eq("tournoi_id", tournoiName).order("id", { ascending: true });
      if (!error) setVentes(data || []);
    } finally { setLoading(false); }
  }, [tournoiName]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("payment_modes").select("*").order("sort_order", { ascending: true });
      if (!error) setPaymentModes(
        (data || []).filter((m) => m.enabled !== false)
          .map((m) => ({ code: m.code || m.label, label: m.label || m.code, emoji: m.emoji || "💶" }))
      );
    })();
  }, []);

  function setField(k, v) {
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "type_produit") next.remise_pct = String(TYPE_MAP[v]?.remise ?? 0);
      return next;
    });
  }

  const finalCents = useMemo(
    () => computeFinal(form.prix_unitaire_cents, form.remise_pct, form.quantite, form.reglement_mode),
    [form.prix_unitaire_cents, form.remise_pct, form.quantite, form.reglement_mode]
  );

  function resetForm() { setForm(EMPTY_FORM); setEditingId(null); }

  function startEdit(v) {
    setEditingId(v.id);
    setForm({
      type_produit: v.type_produit, nom_produit: v.nom_produit,
      couleur: v.couleur || "", taille: v.taille || "",
      prix_unitaire_cents: prixUnitaireFromCents(v.prix_unitaire_cents),
      remise_pct: String(v.remise_pct ?? 0), quantite: String(v.quantite ?? 1),
      reglement_mode: v.reglement_mode || "", notes: v.notes || "",
      vente_groupe_id: v.vente_groupe_id || null,
    });
    document.getElementById("vente-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startAddArticle(groupeId) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, vente_groupe_id: groupeId });
    document.getElementById("vente-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function nextGroupeId() {
    const ids = ventes.map((v) => v.vente_groupe_id || v.id).filter(Boolean);
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  async function handleSave() {
    if (!form.nom_produit.trim()) return alert("Le nom du produit est obligatoire.");
    setSaving(true);
    try {
      const isOffert = String(form.reglement_mode || "").toLowerCase().includes("offert");
      const groupeId = form.vente_groupe_id ?? nextGroupeId();

      const payload = {
        tournoi_id: tournoiName,
        type_produit: form.type_produit,
        nom_produit: form.nom_produit.toUpperCase().trim(),
        couleur: form.couleur.trim() || null,
        taille: form.taille.trim() || null,
        prix_unitaire_cents: Math.round((parseFloat(String(form.prix_unitaire_cents).replace(",", ".")) || 0) * 100),
        remise_pct: parseFloat(String(form.remise_pct).replace(",", ".")) || 0,
        quantite: parseInt(form.quantite, 10) || 1,
        prix_final_cents: isOffert ? 0 : finalCents,
        reglement_mode: form.reglement_mode || null,
        notes: form.notes.trim() || null,
        vente_groupe_id: groupeId,
      };

      if (editingId) {
        const { error } = await supabase.from("tournoi_ventes").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tournoi_ventes").insert([payload]);
        if (error) throw error;
      }
      resetForm();
      await load();
    } catch (e) {
      alert(e.message || "Erreur lors de la sauvegarde");
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteDialog?.id) return setDeleteDialog(null);
    const { error } = await supabase.from("tournoi_ventes").delete().eq("id", deleteDialog.id);
    if (error) { alert(error.message); return; }
    setDeleteDialog(null);
    await load();
  }

  const groupes = useMemo(() => {
    const map = new Map();
    for (const v of ventes) {
      const gid = v.vente_groupe_id ?? v.id;
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid).push(v);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [ventes]);

  const stats = useMemo(() => {
    const byType = {};
    let totalFinalCents = 0, totalItems = 0;
    for (const v of ventes) {
      const t = v.type_produit;
      if (!byType[t]) byType[t] = { count: 0, finalCents: 0, produits: {} };
      byType[t].count += Number(v.quantite) || 1;
      byType[t].finalCents += Number(v.prix_final_cents) || 0;
      const nom = v.nom_produit || "—";
      byType[t].produits[nom] = (byType[t].produits[nom] || 0) + (Number(v.quantite) || 1);
      totalFinalCents += Number(v.prix_final_cents) || 0;
      totalItems += Number(v.quantite) || 1;
    }
    return { byType, totalFinalCents, totalItems };
  }, [ventes]);

  const addingToGroupe = form.vente_groupe_id !== null;

  return (
    <div className="space-y-4">

      {/* ── Formulaire ── */}
      <div
        id="vente-form"
        className={`bg-white rounded-2xl border p-4 ${addingToGroupe ? "border-[#E10600] ring-1 ring-[#E10600]" : ""}`}
      >
        <div className="text-base font-semibold mb-3 flex items-center gap-2">
          {editingId ? "✏️ Modifier l'article" : addingToGroupe ? `➕ Nouvel article — Vente #${form.vente_groupe_id}` : "➕ Nouvelle vente"}
          {addingToGroupe && !editingId && (
            <button onClick={resetForm} className="text-xs px-2 py-1 rounded-lg border text-gray-500 hover:bg-gray-50 ml-auto font-normal">
              Annuler
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Type */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Type</label>
            <select
              className="w-full h-10 px-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E10600] text-sm bg-white"
              value={form.type_produit} onChange={(e) => setField("type_produit", e.target.value)}
            >
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
            </select>
          </div>

          {/* Nom produit */}
          <div className="col-span-1 md:col-span-2">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Nom du produit *</label>
            <input type="text"
              className="w-full h-10 px-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E10600] text-sm uppercase"
              placeholder="EX: ASTROX 88D PRO" value={form.nom_produit}
              onChange={(e) => setField("nom_produit", e.target.value)} />
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Couleur</label>
            <input type="text"
              className="w-full h-10 px-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E10600] text-sm"
              placeholder="Optionnelle" value={form.couleur} onChange={(e) => setField("couleur", e.target.value)} />
          </div>

          {/* Taille */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Taille</label>
            <input type="text"
              className="w-full h-10 px-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E10600] text-sm"
              placeholder="Optionnelle" value={form.taille} onChange={(e) => setField("taille", e.target.value)} />
          </div>

          {/* Prix unitaire */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Prix unitaire (€)</label>
            <input type="number" min="0" step="0.01"
              className="w-full h-10 px-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E10600] text-sm"
              placeholder="0.00" value={form.prix_unitaire_cents}
              onChange={(e) => setField("prix_unitaire_cents", e.target.value)} />
          </div>

          {/* Remise */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">
              Remise (%)
              {form.type_produit !== "volant" && (
                <span className="ml-1 text-orange-500 normal-case">auto: {TYPE_MAP[form.type_produit]?.remise}%</span>
              )}
            </label>
            <input type="number" min="0" max="100" step="1"
              className="w-full h-10 px-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E10600] text-sm"
              value={form.remise_pct} onChange={(e) => setField("remise_pct", e.target.value)} />
          </div>

          {/* Quantité */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Quantité</label>
            <input type="number" min="1" step="1"
              className="w-full h-10 px-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E10600] text-sm"
              value={form.quantite} onChange={(e) => setField("quantite", e.target.value)} />
          </div>

          {/* Prix final */}
          <div className="flex items-end">
            <div className="w-full h-10 px-3 rounded-xl border border-[#E10600] bg-red-50 flex items-center justify-between">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Prix final</span>
              <span className="font-bold text-base" style={{ color: "#E10600" }}>{euro(finalCents)}</span>
            </div>
          </div>

          {/* Règlement — toujours visible, par emojis */}
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Règlement</label>
            <ReglementPicker
              value={form.reglement_mode}
              onChange={(v) => setField("reglement_mode", v)}
              paymentModes={paymentModes}
            />
          </div>

          {/* Notes */}
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</label>
            <input type="text"
              className="w-full h-10 px-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E10600] text-sm"
              placeholder="Optionnel…" value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t flex items-center gap-2">
          <button type="button" disabled={saving} onClick={handleSave}
            className="px-5 h-10 rounded-xl text-white font-semibold text-sm hover:brightness-95 disabled:opacity-50"
            style={{ backgroundColor: "#E10600" }}>
            {saving ? "Enregistrement…" : editingId ? "Mettre à jour" : addingToGroupe ? "Ajouter l'article" : "Créer la vente"}
          </button>
          {(editingId || addingToGroupe) && (
            <button type="button" onClick={resetForm} className="px-4 h-10 rounded-xl border text-gray-700 hover:bg-gray-50 text-sm">
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* ── Liste des ventes groupées ── */}
      <div className="bg-white rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-semibold">
            Ventes ({groupes.length} vente{groupes.length > 1 ? "s" : ""})
          </div>
          {ventes.length > 0 && (
            <div className="text-sm font-bold" style={{ color: "#E10600" }}>
              Total : {euro(stats.totalFinalCents)}
            </div>
          )}
        </div>

        {loading && <div className="text-sm text-gray-500 py-4">Chargement…</div>}
        {!loading && groupes.length === 0 && (
          <div className="text-sm text-gray-400 py-4 text-center">Aucune vente pour ce tournoi.</div>
        )}

        {!loading && groupes.length > 0 && (
          <div className="space-y-3">
            {groupes.map(([gid, lignes]) => (
              <VenteGroupe
                key={gid}
                groupe={lignes}
                onEdit={startEdit}
                onDelete={setDeleteDialog}
                onAddArticle={startAddArticle}
                isSmall={isSmall}
                paymentModes={paymentModes}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Récap ── */}
      {ventes.length > 0 && (
        <div className="bg-white rounded-2xl border p-4">
          <div className="text-base font-semibold mb-3">📊 Récapitulatif</div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {TYPES.map((t) => {
              const s = stats.byType[t.value];
              return (
                <div key={t.value} className={`rounded-xl border p-3 ${s ? "bg-white shadow-sm" : "bg-gray-50 opacity-40"}`}>
                  <div className="text-xs text-gray-400 uppercase tracking-wider">{t.emoji} {t.label}</div>
                  <div className="text-xl font-bold mt-1">{s?.count ?? 0}</div>
                  <div className="text-xs font-semibold" style={{ color: s ? "#E10600" : undefined }}>{s ? euro(s.finalCents) : "—"}</div>
                </div>
              );
            })}
          </div>

          {TYPES.filter((t) => stats.byType[t.value]).map((t) => {
            const s = stats.byType[t.value];
            const produits = Object.entries(s.produits).sort((a, b) => b[1] - a[1]);
            return (
              <div key={t.value} className="mb-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">{t.emoji} {t.label}</div>
                <div className="border rounded-xl overflow-hidden">
                  {produits.map(([nom, qty], i) => (
                    <div key={nom} className={`flex items-center justify-between px-4 py-2 text-sm ${i < produits.length - 1 ? "border-b" : ""}`}>
                      <span className="font-medium">{nom}</span>
                      <span className="font-bold text-gray-700">{qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="mt-3 flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border font-bold">
            <span>Total vendu</span>
            <span>{stats.totalItems} article{stats.totalItems > 1 ? "s" : ""}</span>
            <span style={{ color: "#E10600" }}>{euro(stats.totalFinalCents)}</span>
          </div>
        </div>
      )}

      {/* ── Suppression ── */}
      {deleteDialog && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteDialog(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="text-2xl">🗑️</div>
              <div className="flex-1">
                <div className="text-lg font-semibold">Supprimer cet article ?</div>
                <div className="text-sm text-gray-600 mt-1"><b>{deleteDialog.nom_produit}</b> — {euro(deleteDialog.prix_final_cents)}</div>
              </div>
              <button className="text-gray-500 hover:text-black" onClick={() => setDeleteDialog(null)}>✕</button>
            </div>
            <div className="mt-3 p-3 rounded-xl border bg-gray-50 text-sm">Cette action est <b>définitive</b>.</div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-4 h-10 rounded-xl border text-gray-700 hover:bg-gray-50" onClick={() => setDeleteDialog(null)}>Annuler</button>
              <button className="px-4 h-10 rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={confirmDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}