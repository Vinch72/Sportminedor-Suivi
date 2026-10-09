// src/pages/Cordages.jsx — page dédiée (sortie de Données), mise en page Stringflow
// ⚠️ Le nom du cordage est sa clé (cordages.cordage) : il est recopié dans
// suivi.cordage_id, tournoi_raquettes.cordage_id, tournoi_cordages.cordage_id
// et clients.cordage → un renommage passe par la RPC rename_cordage.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../utils/supabaseClient";
import PageHeader from "../components/ui/PageHeader";
import Toast from "../components/ui/Toast.jsx";
import { IconEdit, IconTrash } from "../components/ui/Icons";
import { CORDAGE_INFO_COLS, CORDAGE_INFO_FIELDS, hasCordageInfo } from "../utils/cordages";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function normStr(s) { return (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function eurosToCents(input) { const v = String(input ?? "").trim().replace(",", "."); if (!v) return null; const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : null; }
function centsToEuros(cents) { if (cents == null) return ""; const n = Number(cents); return Number.isFinite(n) ? (n / 100).toFixed(2).replace(".", ",") : ""; }
const capFirst = (v) => (v ? v[0].toUpperCase() + v.slice(1) : v);

const RED = "#E10600";
const RED_LIGHT = "rgba(225,6,0,0.08)";
const RED_BORDER = "rgba(225,6,0,0.2)";
const GRID = "1fr 120px 110px 100px 100px 130px";

function ActionBubble({ title, onClick, variant = "muted", children }) {
  const style = variant === "danger" ? { borderColor: "#fecaca", color: "#ef4444" }
    : variant === "active" ? { borderColor: RED, color: RED, background: RED_LIGHT }
    : { borderColor: "#e5e7eb", color: "#374151" };
  const hover = variant === "danger" ? "hover:bg-red-50" : "hover:bg-gray-50";
  return <button type="button" title={title} onClick={onClick} className={`h-9 w-9 rounded-full border bg-white flex items-center justify-center transition shrink-0 ${hover}`} style={style}>{children}</button>;
}

function CategoryBadge({ isBase }) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-px rounded-full shrink-0 leading-none"
      style={isBase ? { background: "#eff6ff", color: "#3b82f6" } : { background: "#f5f3ff", color: "#8b5cf6" }}>
      {isBase ? "basique" : "spécifique"}
    </span>
  );
}

const fmtGain = (cents) => (typeof cents === "number" ? `${centsToEuros(cents)} €` : "—");

function IconInfo() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
}

function DotSelector({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-24 shrink-0">{label}</span>
      <div className="flex gap-2 flex-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(value === n ? 0 : n)}
            className="w-8 h-8 rounded-full border-2 transition"
            style={n <= (value || 0) ? { background: RED, borderColor: RED } : { background: "#fff", borderColor: "#d1d5db" }} />
        ))}
      </div>
      <span className="text-xs text-gray-400 w-6 text-right">{value || 0}/5</span>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function Cordages() {
  const [cordages,     setCordages]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState("");
  const [query,        setQuery]        = useState("");
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [formOpen,     setFormOpen]     = useState(false);

  const [editingName, setEditingName] = useState(null); // nom d'origine (clé) en édition
  const [name,        setName]        = useState("");
  const [marque,      setMarque]      = useState("");
  const [isBase,      setIsBase]      = useState(false);
  const [gainEuros,   setGainEuros]   = useState("");
  const [gainMagEuros, setGainMagEuros] = useState("");

  const [toast, setToast] = useState({ open: false, title: "", message: "", variant: "success" });
  const showToast = (title, message, variant = "success") => setToast({ open: true, title, message, variant });

  // Fenêtre "i" : caractéristiques affichées aux joueurs (page QR)
  const [infoCord,   setInfoCord]   = useState(null);
  const [infoVals,   setInfoVals]   = useState({});
  const [infoSaving, setInfoSaving] = useState(false);

  function openInfo(c) {
    setInfoCord(c);
    setInfoVals({
      info_controle: c.info_controle || 0, info_puissance: c.info_puissance || 0,
      info_durabilite: c.info_durabilite || 0, info_note: c.info_note || "",
    });
  }

  async function saveInfo() {
    setInfoSaving(true);
    const patch = {
      info_controle:   infoVals.info_controle   || null,
      info_puissance:  infoVals.info_puissance  || null,
      info_durabilite: infoVals.info_durabilite || null,
      info_note:       (infoVals.info_note || "").trim() || null,
    };
    const { error } = await supabase.from("cordages").update(patch).eq("cordage", infoCord.cordage);
    setInfoSaving(false);
    if (error) { showToast("Erreur", error.message, "warning"); return; }
    setCordages(prev => prev.map(x => x.cordage === infoCord.cordage ? { ...x, ...patch } : x));
    setInfoCord(null);
    showToast("✅ Infos", "Caractéristiques enregistrées.");
  }

  async function loadAll() {
    setLoading(true);
    const { data, error } = await supabase
      .from("cordages")
      .select(`cordage, Couleur, is_base, gain_cents, gain_magasin_cents, marque, ${CORDAGE_INFO_COLS}`)
      .order("marque", { nullsFirst: false }).order("cordage");
    if (error) showToast("Erreur", "Erreur de chargement : " + error.message, "warning");
    setCordages(data || []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setEditingName(null); setName(""); setMarque(""); setIsBase(false);
    setGainEuros(""); setGainMagEuros(""); setErr(""); setFormOpen(false);
  }
  function fillForm(c) {
    setEditingName(c.cordage); setName(c.cordage || ""); setMarque(c.marque || "");
    setIsBase(!!c.is_base); setGainEuros(centsToEuros(c.gain_cents)); setGainMagEuros(centsToEuros(c.gain_magasin_cents));
    setErr(""); setFormOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const newName = name.trim();
    if (!newName) { setErr("Nom du cordage requis."); return; }
    setSaving(true); setErr("");
    try {
      const fields = {
        marque: marque.trim() || null,
        is_base: !!isBase,
        gain_cents: eurosToCents(gainEuros),
        gain_magasin_cents: eurosToCents(gainMagEuros),
      };

      if (editingName) {
        const renamed = newName !== editingName;
        // 1. Renommage (met à jour suivi, tournois, clients… en une transaction)
        if (renamed) {
          const { error } = await supabase.rpc("rename_cordage", { p_old: editingName, p_new: newName });
          if (error) throw error;
        }
        // 2. Autres champs
        const { error } = await supabase.from("cordages").update(fields).eq("cordage", newName);
        if (error) throw error;
        showToast("✅ Modification", renamed ? `Cordage renommé en « ${newName} » partout.` : "Cordage modifié !");
      } else {
        const { error } = await supabase.from("cordages").insert({ cordage: newName, Couleur: "none", ...fields });
        if (error) throw error;
        showToast("✅ Ajout", "Cordage ajouté !");
      }
      resetForm();
      await loadAll();
    } catch (e2) {
      setErr(e2.code === "23505" ? `Un cordage « ${newName} » existe déjà.` : (e2.message || "Erreur"));
    } finally { setSaving(false); }
  }

  async function reallyDelete() {
    const target = deleteDialog;
    if (!target) return;
    const { error } = await supabase.from("cordages").delete().eq("cordage", target.cordage);
    if (error) {
      // Déjà utilisé dans le suivi → proposer un cordage de remplacement
      if (error.code === "23503") { setDeleteDialog({ ...target, used: true, into: "" }); return; }
      setDeleteDialog(null);
      showToast("Suppression impossible", error.message, "warning");
      return;
    }
    setDeleteDialog(null);
    setCordages(prev => prev.filter(x => x.cordage !== target.cordage));
    showToast("🗑️ Suppression", "Cordage supprimé.");
  }

  async function replaceAndDelete() {
    const target = deleteDialog;
    if (!target?.into) return;
    setSaving(true);
    const { error } = await supabase.rpc("merge_cordage", { p_old: target.cordage, p_into: target.into });
    setSaving(false);
    if (error) { showToast("Remplacement impossible", error.message, "warning"); return; }
    setDeleteDialog(null);
    setCordages(prev => prev.filter(x => x.cordage !== target.cordage));
    showToast("✅ Remplacé", `« ${target.cordage} » remplacé par « ${target.into} » partout, puis supprimé.`);
  }

  const filtered = useMemo(() => {
    const q = normStr(query);
    if (!q) return cordages;
    return cordages.filter(c => normStr([c.cordage, c.marque, c.is_base ? "basique" : "specifique"].filter(Boolean).join(" ")).includes(q));
  }, [cordages, query]);

  // Groupes par marque (sans marque en dernier), tri alpha dans chaque groupe
  const groups = useMemo(() => {
    const m = new Map();
    for (const c of filtered) {
      const k = c.marque?.trim() || "";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(c);
    }
    const alpha = (a, b) => (a.cordage || "").localeCompare(b.cordage || "", "fr", { sensitivity: "base" });
    return [...m.entries()]
      .sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b, "fr", { sensitivity: "base" })))
      .map(([k, items]) => ({ marque: k, items: items.sort(alpha) }));
  }, [filtered]);

  const nbBase = cordages.filter(c => c.is_base).length;

  return (
    <div className="p-6">
      <PageHeader
        title="Cordages"
        description="Gérez les cordages disponibles et leurs paramètres de gain."
      />

      {/* Barre : recherche + compteurs + ajout */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtrer…"
            className="w-full h-10 pl-9 pr-3 rounded-xl text-sm text-gray-900 placeholder:text-gray-400"
            style={{ background: "#fff", border: "1px solid #e5e7eb" }} />
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 h-10 rounded-xl text-xs text-gray-500" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
            <b className="text-gray-900 text-sm">{loading ? "…" : cordages.length}</b> cordages
          </div>
          <div className="flex items-center gap-1.5 px-3 h-10 rounded-xl text-xs text-gray-500" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
            <b className="text-gray-900 text-sm">{loading ? "…" : nbBase}</b> basiques
          </div>
        </div>
        <button onClick={() => { resetForm(); setFormOpen(true); }} className="h-10 px-4 rounded-xl text-sm font-bold text-white" style={{ background: RED }}>
          + Ajouter
        </button>
      </div>

      {/* Listes par marque */}
      {loading ? (
        <div className="text-gray-400 text-sm">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-400 text-sm">{cordages.length ? "Aucun résultat." : "Aucun cordage enregistré."}</div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ marque: brand, items }) => (
            <div key={brand || "__none"}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: RED_LIGHT, border: `1.5px solid ${RED_BORDER}` }}>🏸</div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#1f2937", textTransform: "uppercase", letterSpacing: "0.06em" }}>{brand || "Sans marque"}</span>
                <div className="flex-1 h-0.5 rounded-full" style={{ background: RED_BORDER }} />
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: RED_LIGHT, color: RED, border: `1.5px solid ${RED_BORDER}` }}>{items.length}</span>
              </div>

              <div className="rounded-xl overflow-hidden bg-white" style={{ border: "1px solid #e5e7eb" }}>
                {/* Desktop */}
                <div className="hidden md:block">
                  <div className="grid items-center px-3 py-2" style={{ gridTemplateColumns: GRID, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    {["Nom", "Marque", "Catégorie", "Gain tournoi", "Gain magasin", "Actions"].map(h => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af" }}>{h}</div>
                    ))}
                  </div>
                  {items.map((c, i) => (
                    <div key={c.cordage} className="grid items-center px-3 py-2.5 transition-colors hover:bg-gray-50"
                      style={{ gridTemplateColumns: GRID, background: i % 2 === 0 ? "#ffffff" : "#fafafa", borderBottom: i < items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1 h-6 rounded-full shrink-0" style={{ background: RED }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }} className="truncate">{c.cordage}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }} className="truncate">{c.marque || "—"}</div>
                      <div><CategoryBadge isBase={c.is_base} /></div>
                      <div style={{ fontSize: 12, color: "#374151" }}>{fmtGain(c.gain_cents)}</div>
                      <div style={{ fontSize: 12, color: "#374151" }}>{fmtGain(c.gain_magasin_cents)}</div>
                      <div className="flex items-center gap-1">
                        <ActionBubble title={hasCordageInfo(c) ? "Caractéristiques (renseignées)" : "Ajouter des caractéristiques"} onClick={() => openInfo(c)} variant={hasCordageInfo(c) ? "active" : "muted"}><IconInfo /></ActionBubble>
                        <ActionBubble title="Modifier" onClick={() => fillForm(c)}><IconEdit /></ActionBubble>
                        <ActionBubble title="Supprimer" onClick={() => setDeleteDialog(c)} variant="danger"><IconTrash /></ActionBubble>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile */}
                <div className="md:hidden divide-y divide-gray-100">
                  {items.map(c => (
                    <div key={c.cordage} className="p-3 flex items-center gap-2">
                      <div className="w-1 h-8 rounded-full shrink-0" style={{ background: RED }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{c.cordage}</span>
                          <CategoryBadge isBase={c.is_base} />
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Tournoi {fmtGain(c.gain_cents)} · Magasin {fmtGain(c.gain_magasin_cents)}
                        </div>
                      </div>
                      <ActionBubble title="Caractéristiques" onClick={() => openInfo(c)} variant={hasCordageInfo(c) ? "active" : "muted"}><IconInfo /></ActionBubble>
                      <ActionBubble title="Modifier" onClick={() => fillForm(c)}><IconEdit /></ActionBubble>
                      <ActionBubble title="Supprimer" onClick={() => setDeleteDialog(c)} variant="danger"><IconTrash /></ActionBubble>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire popup */}
      {formOpen && (
        <Modal onClose={resetForm} title={editingName ? "Modifier le cordage" : "Ajouter un cordage"}
          subtitle={editingName ? editingName : "Nouveau cordage à référencer"}>
          <form onSubmit={onSubmit} className="p-5 grid grid-cols-1 gap-4">
            <FormField label="Nom *">
              <input className="input-field" value={name} onChange={e => setName(capFirst(e.target.value))} placeholder="ex: BG 65" autoFocus />
              {editingName && name.trim() && name.trim() !== editingName && (
                <div className="mt-1.5 text-xs rounded-lg px-2.5 py-1.5" style={{ background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
                  Le nom sera aussi mis à jour dans le suivi, les tournois et les fiches clients.
                </div>
              )}
            </FormField>
            <FormField label="Marque">
              <input className="input-field" value={marque} onChange={e => setMarque(capFirst(e.target.value))} placeholder="ex: Yonex, Babolat…" />
            </FormField>
            <FormField label="Catégorie">
              <div className="flex gap-2">
                {[{ v: true, label: "Basique" }, { v: false, label: "Spécifique" }].map(opt => (
                  <button key={opt.label} type="button" onClick={() => setIsBase(opt.v)} className="flex-1 h-9 rounded-lg text-xs font-semibold transition"
                    style={isBase === opt.v
                      ? { background: RED_LIGHT, border: `1px solid ${RED}`, color: RED }
                      : { background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Gain tournoi (€)">
                <input className="input-field" inputMode="decimal" value={gainEuros} onChange={e => setGainEuros(e.target.value)} placeholder="ex: 2,50" />
              </FormField>
              <FormField label="Gain magasin (€)">
                <input className="input-field" inputMode="decimal" value={gainMagEuros} onChange={e => setGainMagEuros(e.target.value)} placeholder="ex: 3,00" />
              </FormField>
            </div>
            {err && <div className="text-red-600 text-sm">{err}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="px-4 h-9 rounded-xl text-sm border border-gray-200 text-gray-500">Annuler</button>
              <button type="submit" disabled={saving} className="px-4 h-9 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: RED }}>
                {saving ? (editingName ? "Mise à jour…" : "Ajout…") : (editingName ? "Mettre à jour" : "Ajouter")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Caractéristiques (i) */}
      {infoCord && (
        <Modal onClose={() => setInfoCord(null)} title="🎯 Caractéristiques" subtitle={[infoCord.cordage, infoCord.marque].filter(Boolean).join(" · ")}>
          <div className="p-5 space-y-4">
            {CORDAGE_INFO_FIELDS.map(f => (
              <DotSelector key={f.key} label={f.label} value={infoVals[f.key]}
                onChange={v => setInfoVals(s => ({ ...s, [f.key]: v }))} />
            ))}
            <div className="pt-1 border-t">
              <label className="block text-sm text-gray-600 mb-1 mt-2">Note courte (optionnel)</label>
              <textarea rows={2} value={infoVals.info_note}
                onChange={e => setInfoVals(s => ({ ...s, info_note: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none"
                placeholder="Ex : Idéal pour les joueurs cherchant du contrôle" />
            </div>
            <p className="text-xs text-gray-400">Visible par les joueurs via le bouton « i » de la page QR. Laisse un critère à 0 pour ne pas l'afficher.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setInfoCord(null)} className="flex-1 h-10 rounded-xl border text-sm text-gray-600">Annuler</button>
              <button type="button" onClick={saveInfo} disabled={infoSaving} className="flex-1 h-10 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: RED }}>
                {infoSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation suppression */}
      {deleteDialog && (
        <Modal onClose={() => setDeleteDialog(null)} title="Supprimer ce cordage ?" subtitle={[deleteDialog.marque, deleteDialog.cordage].filter(Boolean).join(" · ")}>
          {!deleteDialog.used ? (
            <div className="p-5">
              <div className="p-3 rounded-xl text-sm bg-amber-50 border border-amber-200 text-amber-800">⚠️ Action <b>définitive</b>.</div>
              <div className="mt-4 flex justify-end gap-2">
                <button className="px-4 h-10 rounded-xl text-sm border border-gray-200 text-gray-600" onClick={() => setDeleteDialog(null)}>Annuler</button>
                <button className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-red-600" onClick={reallyDelete}>Supprimer</button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              <div className="p-3 rounded-xl text-sm bg-amber-50 border border-amber-200 text-amber-800">
                Ce cordage est utilisé dans le suivi. Choisis par quel cordage le <b>remplacer partout</b> (suivi, tournois, fiches clients, raquettes) avant de le supprimer.
              </div>
              <FormField label="Remplacer par">
                <select className="input-field bg-white" value={deleteDialog.into}
                  onChange={e => setDeleteDialog(d => ({ ...d, into: e.target.value }))}>
                  <option value="">— Choisir un cordage —</option>
                  {cordages.filter(x => x.cordage !== deleteDialog.cordage).map(x => (
                    <option key={x.cordage} value={x.cordage}>{[x.marque, x.cordage].filter(Boolean).join(" · ")}</option>
                  ))}
                </select>
              </FormField>
              <div className="flex justify-end gap-2">
                <button className="px-4 h-10 rounded-xl text-sm border border-gray-200 text-gray-600" onClick={() => setDeleteDialog(null)}>Annuler</button>
                <button className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-red-600 disabled:opacity-40"
                  disabled={!deleteDialog.into || saving} onClick={replaceAndDelete}>
                  {saving ? "…" : "Remplacer et supprimer"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      <Toast open={toast.open} onClose={() => setToast(t => ({ ...t, open: false }))} title={toast.title} message={toast.message} variant={toast.variant} />
    </div>
  );
}

function FormField({ label, children }) {
  return <label className="block"><span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span><div className="mt-1">{children}</div></label>;
}

function Modal({ title, subtitle, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 modal-overlay" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl bg-white overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: RED_LIGHT }}>🧵</div>
            <div className="min-w-0">
              <div className="font-bold text-gray-900 leading-tight">{title}</div>
              {subtitle && <div className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</div>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="h-8 w-8 rounded-full border flex items-center justify-center text-gray-500 hover:bg-gray-50 shrink-0">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
