// src/pages/Clubs.jsx
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../utils/supabaseClient";
import logo from "../assets/sportminedor-logo.png"

// Helpers
function normStr(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* ===== Icônes ===== */
function IconEdit(props){
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         className="w-4 h-4" {...props}>
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  );
}
function IconTrash(props){
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         className="w-4 h-4" {...props}>
      <path d="M3 6h18"/>
      <path d="M8 6v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>
  );
}
function IconRacketShuttle(props){
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
         className="w-4 h-4" {...props}>
      <circle cx="7" cy="7" r="3.5"/>
      <path d="M9.5 9.5l9 9"/>
      <path d="M16 16l2 2"/>
      <path d="M18 14l2 2"/>
      <path d="M20 12l2 2"/>
    </svg>
  );
}

/* ===== Helpers saison ===== */
function getSeasonBounds(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0=janv, 8=sept
  const startYear = m >= 8 ? y : y - 1;
  const start = new Date(startYear, 8, 1); // 1 sept
  const end   = new Date(startYear + 1, 7, 31, 23, 59, 59, 999); // 31 août inclus
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { startISO: toISO(start), endISO: toISO(end) };
}

export default function Clubs() {
  // Modale suppression club
const [deleteDialog, setDeleteDialog] = useState(null);
  // lists
  const [clubs, setClubs] = useState([]);
  const [cordages, setCordages] = useState([]);

  // form (create/edit)
  const [editingName, setEditingName] = useState(null); // primary key is the "clubs" name
  const isEdit = !!editingName;

  const [name, setName] = useState("");
  const [bobineBase, setBobineBase] = useState(false);
  const [bobineSpec, setBobineSpec] = useState(false);

  // Logo upload
const [logoFile, setLogoFile] = useState(null);      // File
const [logoPreview, setLogoPreview] = useState("");  // data URL ou URL existante

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // popup
  const [selected, setSelected] = useState(null);
  const [bobineUI, setBobineUI] = useState({
  open: false,
  type: null,        // "base" | "specific"
  batchIndex: 0,     // 0 = prochain lot à facturer
  rows: [],
  loading: false,
  error: "",
});
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // saison bounds
  const { startISO: seasonStart, endISO: seasonEnd } = useMemo(() => getSeasonBounds(new Date()), []);

  // alert badge per club (multiples of 20)
  const [alerts, setAlerts] = useState({}); // { [clubName]: number }

  const doneBase = Number(selected?.billed_base_batches ?? 0);
  const doneSpec = Number(selected?.billed_spec_batches ?? 0);

  async function loadAll() {
    setLoading(true); setErr("");
    try {
      const [clb, crd] = await Promise.all([
        supabase
          .from("clubs")
          .select("clubs, bobine_base, bobine_specific, note, billed_base_batches, billed_spec_batches, logo_url")
          .order("clubs"),
        supabase
          .from("cordages")
          .select("cordage, is_base")
          .order("cordage"),
      ]);      
      const firstErr = [clb, crd].find(r => r.error)?.error;
      if (firstErr) throw firstErr;
      setClubs(clb.data || []);
      setCordages(crd.data || []);
    } catch (e) {
      setErr(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  // Recherche
const [query, setQuery] = useState("");

// Liste filtrée (garde l'ordre alphabétique d'origine)
const filteredClubs = useMemo(() => {
  const q = normStr(query);
  if (!q) return clubs || [];
  return (clubs || []).filter(c => normStr(c.clubs || c.name || "").includes(q));
}, [clubs, query]);

  useEffect(() => { loadAll(); }, []);

  function resetForm() {
    setEditingName(null);
    setName("");
    setBobineBase(false);
    setBobineSpec(false);
  }
  function fillForm(c) {
    setEditingName(c.clubs);
    setName(c.clubs);
    setBobineBase(!!c.bobine_base);
    setBobineSpec(!!c.bobine_specific);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setLogoPreview(c.logo_url || "");
    setLogoFile(null);
  }

  // === CRUD form ===
  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      if (!name?.trim()) throw new Error("Nom du club requis.");
      const payload = {
        clubs: name.trim(),
        bobine_base: !!bobineBase,
        bobine_specific: !!bobineSpec,
      };

      // … après const payload = { clubs: ..., bobine_base: ..., bobine_specific: ... };

let logoUrlToSave = null;

if (logoFile) {
  // extension simple
  const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
  // chemin unique et “safe”
  const safeName = payload.clubs.replace(/[^\p{L}\p{N}_-]+/gu, "-").toLowerCase();
  const path = `clubs/${safeName}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase
    .storage
    .from("club-logos")
    .upload(path, logoFile, { upsert: true });

  if (upErr) throw upErr;

  const { data: pub } = supabase
    .storage
    .from("club-logos")
    .getPublicUrl(path);

  logoUrlToSave = pub?.publicUrl || null;
}

const finalPayload = { ...payload, logo_url: logoUrlToSave ?? (isEdit ? undefined : null) };

      if (isEdit) {
        // si le nom (clé) change, on fait simple: delete + insert (ou on update si PK n'est pas la clé)
        // update
if (editingName !== finalPayload.clubs) {
  const { data: exist } = await supabase
    .from("clubs").select("clubs").eq("clubs", finalPayload.clubs).maybeSingle();
  if (exist) throw new Error("Un club avec ce nom existe déjà.");

  const { error: upErr } = await supabase
    .from("clubs")
    .update(finalPayload)
    .eq("clubs", editingName);
  if (upErr) throw upErr;
} else {
  const { error } = await supabase
    .from("clubs")
    .update(finalPayload)
    .eq("clubs", editingName);
  if (error) throw error;
}

// maj locale
setClubs(prev => prev.map(c =>
  c.clubs === editingName ? { ...c, ...finalPayload, logo_url: finalPayload.logo_url ?? c.logo_url } : c
));
await refreshAlerts();
window.dispatchEvent(new CustomEvent("clubs:updated", { detail: { clubs: finalPayload.clubs }}));
resetForm();
return;
      }

      // insert
      const { data, error } = await supabase
      .from("clubs")
      .insert(finalPayload)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    
    setClubs(prev => [data, ...prev]);
    await refreshAlerts();
    window.dispatchEvent(new CustomEvent("clubs:updated", { detail: { clubs: data.clubs }}));
    resetForm();
    
    } catch (e) {
      setErr(e.message || "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  function closeDeleteDialog() {
    setDeleteDialog(null);
  }
  
  async function confirmDeleteClub() {
    if (!deleteDialog?.name) return closeDeleteDialog();
  
    try {
      // Protection éventuelle (facultatif) :
      if (deleteDialog.name.trim().toLowerCase() === "autre") {
        alert('Le club "Autre" est réservé et ne peut pas être supprimé.');
        return;
      }
  
      const { error } = await supabase
        .from("clubs")
        .delete()
        .eq("clubs", deleteDialog.name);
  
      if (error) {
        if (/foreign key/i.test(error.message)) {
          alert(
            "Suppression impossible : ce club est utilisé par des raquettes.\n" +
            "Change d’abord le club sur ces lignes, puis réessaie."
          );
        } else {
          alert("Suppression refusée : " + (error.message || "erreur inconnue"));
        }
        return;
      }
  
      // ✅ maj locale + refresh
      setClubs(prev => prev.filter(x => x.clubs !== deleteDialog.name));
      if (selected?.clubs === deleteDialog.name) setSelected(null);
      window.dispatchEvent(new CustomEvent("clubs:updated", { detail: { clubs: deleteDialog.name }}));
    } finally {
      closeDeleteDialog();
    }
  }  

  // === Compteurs saison pour un club (total/base/spec) ===
  const baseCordages = useMemo(
    () => cordages.filter(c => !!c.is_base).map(c => c.cordage),
    [cordages]
  );
  const specCordages = useMemo(
    () => cordages.filter(c => !c.is_base).map(c => c.cordage),
    [cordages]
  );

  async function fetchClubSeasonStats(clubName) {
    // total
    const totalQ = supabase
      .from("suivi")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubName)
      .gte("date", seasonStart)
      .lte("date", seasonEnd);

    // base
    const baseQ = supabase
  .from("suivi")
  .select("id", { count: "exact", head: true })
  .eq("club_id", clubName)
  .gte("date", seasonStart)
  .lte("date", seasonEnd)
  .eq("bobine_used", "base");

    // spécifique
    const specQ = supabase
  .from("suivi")
  .select("id", { count: "exact", head: true })
  .eq("club_id", clubName)
  .gte("date", seasonStart)
  .lte("date", seasonEnd)
  .eq("bobine_used", "specific");

    const [t, b, s] = await Promise.all([totalQ, baseQ, specQ]);
    const err = [t, b, s].find(r => r.error)?.error;
    if (err) throw err;
    return {
      total: t.count ?? 0,
      base: b.count ?? 0,
      spec: s.count ?? 0,
    };
  }

  // Alertes sur bulles : multiples de 20 pour base/spec
  async function refreshAlerts() {
    if (!clubs.length) return;
    const entries = await Promise.all(
      clubs.map(async (c) => {
        try {
          const st = await fetchClubSeasonStats(c.clubs);
          const pBase = Math.floor((st.base ?? 0) / 20);
          const pSpec = Math.floor((st.spec ?? 0) / 20);
  
          const doneBase = Number(c.billed_base_batches ?? 0);
          const doneSpec = Number(c.billed_spec_batches ?? 0);
  
          // 👉 ne compter que les types que le club possède
          const pendingBase = c.bobine_base     ? Math.max(0, pBase - doneBase) : 0;
          const pendingSpec = c.bobine_specific ? Math.max(0, pSpec - doneSpec) : 0;
  
          const badge = pendingBase + pendingSpec;
          return [c.clubs, badge];
        } catch {
          return [c.clubs, 0];
        }
      })
    );
    setAlerts(Object.fromEntries(entries));
  }    

  // recharge les alertes quand lists prêtes
  useEffect(() => {
    if (!clubs.length || !cordages.length) return;
    refreshAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubs, cordages, seasonStart, seasonEnd]);

  // recalculer les alertes quand le suivi change (création / update)
useEffect(() => {
  const handler = () => { refreshAlerts(); };
  window.addEventListener("suivi:created", handler);
  window.addEventListener("suivi:updated", handler);
  return () => {
    window.removeEventListener("suivi:created", handler);
    window.removeEventListener("suivi:updated", handler);
  };
}, []);

  // === Popup: charger stats à l'ouverture ===
  const [stats, setStats] = useState({ total: 0, base: 0, spec: 0, loading: false, error: "" });
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selected) return;
      setStats(s => ({ ...s, loading: true, error: "" }));
      try {
        const st = await fetchClubSeasonStats(selected.clubs);
        if (alive) setStats({ ...st, loading: false, error: "" });
      } catch (e) {
        if (alive) setStats({ total: 0, base: 0, spec: 0, loading: false, error: e.message || "Erreur stats" });
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, seasonStart, seasonEnd, baseCordages.join("|"), specCordages.join("|")]);

  const { pendingBase, pendingSpec } = useMemo(() => {
    if (!selected) return { pendingBase: 0, pendingSpec: 0 };
  
    const doneBase = Number(selected.billed_base_batches ?? 0);
    const doneSpec = Number(selected.billed_spec_batches ?? 0);
    const pBase = Math.floor((stats.base ?? 0) / 20);
    const pSpec = Math.floor((stats.spec ?? 0) / 20);
  
    return {
      pendingBase: selected.bobine_base     ? Math.max(0, pBase - doneBase) : 0,
      pendingSpec: selected.bobine_specific ? Math.max(0, pSpec - doneSpec) : 0,
    };
  }, [selected, stats.base, stats.spec]);  
  
function downloadCSV(filename, rows) {
  const header = ["Nom", "Date dépôt", "Lieu", "Cordage", "Raquette"];
  const lines = [
    header.join(";"),
    ...(rows || []).map(r => [
      (r.client_name || "").replace(/;/g, ","),
      (r.date || ""),
      (r.lieu_id || "").replace(/;/g, ","),
      (r.cordage_id || "").replace(/;/g, ","),
      (r.raquette || "").replace(/;/g, ","),
    ].join(";"))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchBobineBatch({ clubName, type, offset }) {
  return await supabase
    .from("suivi")
    .select("id, client_name, date, lieu_id, cordage_id, raquette, created_at")
    .eq("club_id", clubName)
    .eq("bobine_used", type)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .range(offset, offset + 19);
}

async function openBobineLot(type, batchIndex) {
  if (!selected) return;
  const offset = batchIndex * 20;

  setBobineUI(s => ({
    ...s,
    open: true,
    type,
    batchIndex,
    loading: true,
    error: "",
    rows: [],
  }));

  const { data, error } = await fetchBobineBatch({
    clubName: selected.clubs,
    type,
    offset
  });

  setBobineUI(s => ({
    ...s,
    loading: false,
    error: error ? (error.message || "Erreur") : "",
    rows: data || []
  }));
}

  async function markBilled(type) {
    if (!selected) return;
    const col = type === "base" ? "billed_base_batches" : "billed_spec_batches";
  
    const { data, error } = await supabase
      .from("clubs")
      .update({ [col]: (selected[col] ?? 0) + 1 })
      .eq("clubs", selected.clubs)
      .select("*")  // on récupère la ligne à jour
      .maybeSingle();
  
    if (error) {
      alert(error.message || "Impossible de marquer comme facturé");
      return;
    }
  
    // maj locale
    setClubs(prev => prev.map(c => c.clubs === selected.clubs ? data : c));
    setSelected(data);
    refreshAlerts();
  }  

  async function saveNotes() {
    if (!selected) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("clubs")
        .update({ note: notesDraft ?? null })
        .eq("clubs", selected.clubs); // ⚠️ pas de .select() ici
  
      if (error) throw error;
  
      // ✅ Update optimiste local
      const updated = { ...selected, note: notesDraft ?? null };
      setClubs(prev => prev.map(c => c.clubs === selected.clubs ? updated : c));
      setSelected(updated);
  
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 1600);
  
      // (optionnel) si d’autres parties dépendent des clubs
      window.dispatchEvent(new CustomEvent("clubs:updated", { detail: { clubs: updated.clubs }}));
    } catch (e) {
      alert(e.message || "Erreur à l'enregistrement de la note");
    } finally {
      setSavingNotes(false);
    }
  }  

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <img
          src={logo}
          alt=""
          className="h-8 w-8 rounded-full select-none"
        />
        <span>Gestion des Clubs</span>
      </h1>

      {/* Formulaire rouge/noir */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100">
        <div className="px-5 py-4 border-b bg-brand-dark text-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{isEdit ? "Modifier le club" : "Ajouter un club"}</div>
            {isEdit && (
              <button onClick={resetForm} className="text-sm underline decoration-brand-red hover:opacity-90">
                Annuler l’édition
              </button>
            )}
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Nom du club" required>
            <input className="w-full border rounded-lg p-2" value={name} onChange={e=>setName(e.target.value)} />
          </Field>

          <Field label="Bobine classique (base)">
            <Toggle checked={bobineBase} onChange={setBobineBase} />
          </Field>

          <Field label="Bobine spéciale (spécifique)">
            <Toggle checked={bobineSpec} onChange={setBobineSpec} />
          </Field>

          <Field label="Logo">
  <LogoUploader
    value={logoPreview}
    onFile={async (f) => {
      setLogoFile(f);
      const dataUrl = await fileToDataUrl(f);
      setLogoPreview(dataUrl);
    }}
    onClear={() => { setLogoFile(null); setLogoPreview(""); }}
  />
</Field>

          {err && <div className="md:col-span-3 text-red-600">{err}</div>}

          <div className="md:col-span-3 flex justify-end gap-2">
            {isEdit && (
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border">
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-brand-red text-white disabled:opacity-50"
            >
              {saving ? (isEdit ? "Mise à jour…" : "Ajout…") : (isEdit ? "Mettre à jour" : "Ajouter")}
            </button>
          </div>
        </form>
      </div>

      {/* Recherche club */}
<div className="mt-6">
  <label className="block text-sm text-gray-600 mb-1">Rechercher un club</label>
  <div className="relative">
    {/* icône loupe centrée verticalement */}
    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </div>

    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Tape le nom d’un club…"
      className="w-full h-11 pl-10 pr-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-red"
    />
  </div>
</div>

      {/* Liste des clubs */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Clubs existants</h2>
        {loading ? (
  <div className="text-gray-500">Chargement…</div>
) : filteredClubs.length === 0 ? (
  <div className="text-gray-500">Aucun résultat.</div>
) : (
  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {filteredClubs.map((c, idx) => {
              const badge = alerts[c.clubs] || 0;
              return (
                <li key={c?.clubs || `club-${idx}`} className="relative">
  {badge > 0 && (
    <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full px-1.5 py-0.5 shadow">
      {badge}
    </div>
  )}

  <div
    role="button"
    tabIndex={0}
    onClick={() => { setSelected(c); setNotesDraft(c?.note ?? ""); }}
    onKeyDown={(e) => { if (e.key === "Enter") { setSelected(c); setNotesDraft(c?.note ?? ""); }}}
    className="w-full text-left bg-white border border-gray-200 rounded-2xl shadow-card p-4 hover:shadow outline-none focus:ring-2 focus:ring-brand-red/40"
  >
    <div className="flex items-start justify-between gap-3">
  <div className="flex items-center gap-3">
    <div className="w-12 h-12 rounded-md bg-gray-100 border overflow-hidden flex items-center justify-center">
      {c?.logo_url
        ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
        : <span className="text-[10px] text-gray-500">Logo</span>}
    </div>
    <div>
      <div className="font-semibold text-brand-dark">{c?.clubs ?? "—"}</div>
      <div className="text-xs text-gray-600 mt-1">
        Base: {c?.bobine_base ? "Oui" : "Non"} • Spécifique: {c?.bobine_specific ? "Oui" : "Non"}
      </div>
    </div>
  </div>

      <div className="flex items-center gap-1">
        {/* ✏️ */}
        <button
          type="button"
          title="Modifier"
          onClick={(e) => { e.stopPropagation(); fillForm(c); }}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <IconEdit />
        </button>

        {/* 🗑️ */}
        <button
          type="button"
          title="Supprimer"
          onClick={(e) => { 
            e.stopPropagation(); 
            setDeleteDialog({ name: c.clubs }); // ⬅️ on ouvre la modale jolie
          }}
          className="p-2 rounded-full hover:bg-red-100 text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          <IconTrash />
        </button>
      </div>
    </div>

    {c?.note && (
      <div className="mt-2 text-xs text-gray-600">
        📝 {String(c.note).length > 90 ? String(c.note).slice(0, 90) + "…" : c.note}
      </div>
    )}
  </div>
</li>
              );
            })}
          </ul>
        )}
        {deleteDialog && (
  <Modal title="Supprimer ce club ?" onClose={closeDeleteDialog}>
    <div className="text-sm text-gray-700">
      <div className="mb-2">
        Tu es sur le point de supprimer :
        <b className="ml-1">{deleteDialog.name}</b>
      </div>
      <div className="p-3 rounded-xl border bg-gray-50">
        Cette action est <b>définitive</b>.<br />
        Si le club est référencé par des raquettes, la suppression sera refusée.
      </div>
    </div>

    <div className="mt-5 flex justify-end gap-2">
      <button
        className="px-4 h-10 rounded-xl border text-gray-700 hover:bg-gray-50"
        onClick={closeDeleteDialog}
      >
        Annuler
      </button>
      <button
        className="px-4 h-10 rounded-xl bg-red-600 text-white hover:bg-red-700"
        onClick={confirmDeleteClub}
      >
        Supprimer
      </button>
    </div>
  </Modal>
)}
      </div>

      {/* Popup détail + stats + notes */}
      {selected && (
        <Modal onClose={() => setSelected(null)} title="Fiche club">
          {selected.logo_url && (
            <div className="mb-3">
              <img src={selected.logo_url} alt="" className="w-16 h-16 rounded-md object-cover border" />
            </div>
          )}
          <Detail label="Nom" value={selected.clubs ?? "—"} />
          <Detail label="Bobine classique (base)" value={selected.bobine_base ? "Oui" : "Non"} />
          <Detail label="Bobine spéciale (spécifique)" value={selected.bobine_specific ? "Oui" : "Non"} />

          <div className="mt-3 p-3 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
  <span>🏸</span>
  <div>Raquettes cordées (saison)</div>
</div>

<div className="mt-4 p-3 border rounded-lg bg-white">
  <div className="font-medium mb-3">Cordages à facturer</div>

  {/* ===== BASE ===== */}
  {selected?.bobine_base && (
    <div className="p-3 rounded-xl border mb-3">
      <div className="font-semibold">Base (lot de 20)</div>
      <div className="mt-1 text-sm text-gray-700 space-y-0.5">
        <div>✔ Facturées : <b>{doneBase}</b></div>
        <div>⏳ En attente : <b>{pendingBase}</b></div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded-lg border"
          disabled={pendingBase <= 0}
          onClick={() => openBobineLot("base", doneBase)}
        >
          Voir prochain lot
        </button>

        {doneBase > 0 && (
          <details className="w-full mt-2">
            <summary className="cursor-pointer underline text-sm select-none">
              Voir l’historique ({doneBase})
            </summary>

            <div className="mt-2 flex flex-col gap-2">
              {Array.from({ length: doneBase }).map((_, i) => (
                <div key={`base-lot-${i}`} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border text-left"
                    onClick={() => openBobineLot("base", i)}
                  >
                    ✅ Lot #{i + 1}
                  </button>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border"
                    onClick={async () => {
                      const { data, error } = await fetchBobineBatch({
                        clubName: selected.clubs,
                        type: "base",
                        offset: i * 20,
                      });
                      if (error) return alert(error.message || "Erreur");
                      downloadCSV(`club_${selected.clubs}_base_lot${i + 1}.csv`, data || []);
                    }}
                  >
                    CSV
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )}

  {/* ===== SPECIFIQUE ===== */}
  {selected?.bobine_specific && (
    <div className="p-3 rounded-xl border">
      <div className="font-semibold">Spécifique (lot de 20)</div>
      <div className="mt-1 text-sm text-gray-700 space-y-0.5">
        <div>✔ Facturées : <b>{doneSpec}</b></div>
        <div>⏳ En attente : <b>{pendingSpec}</b></div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded-lg border"
          disabled={pendingSpec <= 0}
          onClick={() => openBobineLot("specific", doneSpec)}
        >
          Voir prochain lot
        </button>

        {doneSpec > 0 && (
          <details className="w-full mt-2">
            <summary className="cursor-pointer underline text-sm select-none">
              Voir l’historique ({doneSpec})
            </summary>

            <div className="mt-2 flex flex-col gap-2">
              {Array.from({ length: doneSpec }).map((_, i) => (
                <div key={`spec-lot-${i}`} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border text-left"
                    onClick={() => openBobineLot("specific", i)}
                  >
                    ✅ Lot #{i + 1}
                  </button>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border"
                    onClick={async () => {
                      const { data, error } = await fetchBobineBatch({
                        clubName: selected.clubs,
                        type: "specific",
                        offset: i * 20,
                      });
                      if (error) return alert(error.message || "Erreur");
                      downloadCSV(`club_${selected.clubs}_spec_lot${i + 1}.csv`, data || []);
                    }}
                  >
                    CSV
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )}

  {!selected?.bobine_base && !selected?.bobine_specific && (
    <div className="text-gray-500">Aucune bobine activée pour ce club.</div>
  )}
</div>

{/* ===== PANNEAU DÉTAIL LOT (table) ===== */}
{bobineUI.open && (
  <div className="mt-3">
    <div className="flex items-center justify-between gap-2">
      <div className="text-sm font-semibold">
        Détail bobine : {bobineUI.type === "base" ? "Base" : "Spécifique"} — Lot #{(bobineUI.batchIndex ?? 0) + 1}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-3 py-1 rounded border"
          onClick={() => {
            const lot = (bobineUI.batchIndex ?? 0) + 1;
            downloadCSV(`club_${selected.clubs}_${bobineUI.type}_lot${lot}.csv`, bobineUI.rows);
          }}
          disabled={bobineUI.loading || !bobineUI.rows?.length}
        >
          Exporter CSV
        </button>

        <button
          type="button"
          aria-label="Fermer"
          className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-gray-50"
          onClick={() => setBobineUI(s => ({ ...s, open: false, rows: [], error: "" }))}
        >
          ✕
        </button>
      </div>
    </div>

    {bobineUI.loading ? (
      <div className="text-sm text-gray-500 mt-2">Chargement…</div>
    ) : bobineUI.error ? (
      <div className="text-sm text-red-600 mt-2">{bobineUI.error}</div>
    ) : (
      <div className="mt-2 border rounded-lg" style={{ maxHeight: "60vh", overflowY: "auto" }}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Joueur</th>
              <th className="text-left p-2">Date dépôt</th>
              <th className="text-left p-2">Lieu</th>
              <th className="text-left p-2">Cordage</th>
            </tr>
          </thead>
          <tbody>
            {(bobineUI.rows || []).map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.client_name || "—"}</td>
                <td className="p-2">{r.date || "—"}</td>
                <td className="p-2">{r.lieu_id || "—"}</td>
                <td className="p-2">{r.cordage_id || "—"}</td>
              </tr>
            ))}
            {!bobineUI.rows?.length && (
              <tr className="border-t">
                <td className="p-2 text-gray-500" colSpan={4}>Aucune ligne trouvée pour ce lot.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}

            {stats.loading ? (
              <div className="text-sm text-gray-500 mt-1">Calcul…</div>
            ) : stats.error ? (
              <div className="text-sm text-red-600 mt-1">{stats.error}</div>
            ) : (
              <div className="mt-2 text-sm text-gray-700 space-y-1">
                <div>Total : <span className="font-semibold">{stats.total}</span></div>
                <div>Avec cordage <span className="font-semibold">base</span> : <span className="font-semibold">{stats.base}</span></div>
                <div>Avec cordage <span className="font-semibold">spécifique</span> : <span className="font-semibold">{stats.spec}</span></div>
              </div>
            )}
          </div>

          <div className="mt-2 p-3 border rounded-lg">
  <div className="text-sm font-medium mb-2">Paliers de 20 en attente</div>

  <div className="flex flex-col gap-2 text-sm">
    {selected?.bobine_base && (
      <div className="flex items-center gap-2">
        <span>Base :</span>
        <span className="font-semibold">{pendingBase}</span>
        <button
          type="button"
          disabled={pendingBase <= 0}
          onClick={() => markBilled("base")}
          className="px-2 py-1 rounded border disabled:opacity-50"
          title="Marquer 1 bobine base facturée"
        >
          Bobine facturée ✓
        </button>
      </div>
    )}

    {selected?.bobine_specific && (
      <div className="flex items-center gap-2">
        <span>Spécifique :</span>
        <span className="font-semibold">{pendingSpec}</span>
        <button
          type="button"
          disabled={pendingSpec <= 0}
          onClick={() => markBilled("specific")}
          className="px-2 py-1 rounded border disabled:opacity-50"
          title="Marquer 1 bobine spécifique facturée"
        >
          Bobine facturée ✓
        </button>
      </div>
    )}

    {/* Si aucune bobine activée */}
    {!selected?.bobine_base && !selected?.bobine_specific && (
      <div className="text-gray-500">Aucune bobine activée pour ce club.</div>
    )}
  </div>
</div>

          <div className="mt-4">
            <div className="text-sm text-gray-500 mb-1">Note</div>
            <textarea
              rows={2}
              className="w-full border rounded-lg p-2 resize-y min-h-[72px] max-h-[220px]"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Note libre…"
            />
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={saveNotes}
                disabled={savingNotes}
                className="px-4 py-2 rounded-lg bg-brand-red text-white disabled:opacity-50"
              >
                {savingNotes ? "Enregistrement…" : notesSaved ? "Enregistré ✓" : "Enregistrer la note"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ===== UI helpers ===== */
function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-600">{label}{required ? " *" : ""}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full h-[38px] rounded-lg border flex items-center justify-center ${checked ? "bg-brand-red text-white" : ""}`}
    >
      {checked ? "Oui" : "Non"}
    </button>
  );
}
function Detail({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b">
      <div className="text-gray-500 flex-shrink-0 min-w-[6.5rem]">{label}</div>
      <div className="font-medium flex-1 text-right break-words">{String(value ?? "—")}</div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  // Échap + bloque le scroll de la page
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[10000]">
      {/* Backdrop cliquable */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Carte centrée */}
      <div className="absolute inset-0 flex justify-center px-3 py-4 sm:py-8 overflow-y-auto">
        <div
  className="
    relative bg-white shadow-card rounded-2xl
    w-full max-w-5xl
    max-h-[85vh]
    overflow-hidden flex flex-col
  "
>
          {/* Header sticky (X) */}
          <div className="sticky top-0 z-10 bg-white px-4 py-2.5 border-b flex items-center justify-between">
            <h3 className="font-semibold text-base">{title}</h3>
            <button
  type="button"
  onClick={onClose}
  aria-label="Fermer"
  className="h-9 w-9 rounded-full border flex items-center justify-center bg-white text-black hover:bg-gray-50"
  style={{ zIndex: 20 }}
>
  ✕
</button>
          </div>

          {/* Contenu scrolable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 text-sm break-words min-w-0">
            {children}
          </div>

          {/* Footer sticky : bouton bas surtout utile sur mobile */}
          <div className="sticky bottom-0 bg-white px-4 py-2.5 border-t text-right sm:hidden">
            <button onClick={onClose} className="px-4 py-2 rounded border">Fermer</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function LogoUploader({ value, onFile, onClear }) {
  // value = url (preview) si déjà présent
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files) {
    const f = files?.[0];
    if (!f) return;
    if (!/image\/(png|jpe?g|webp)/i.test(f.type)) {
      alert("Image PNG/JPG/WebP attendue.");
      return;
    }
    if (f.size > 1024 * 1024) {
      alert("Image trop lourde (> 1MB). Réduis-la.");
      return;
    }
    onFile(f);
  }

  return (
    <div
      className={`border rounded-lg p-3 bg-white ${dragOver ? "ring-2 ring-brand-red" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-md bg-gray-100 border overflow-hidden flex items-center justify-center">
          {value ? (
            <img src={value} alt="Logo club" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-gray-500">Logo</span>
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm text-gray-700">Logo du club</div>
          <div className="text-xs text-gray-500">PNG / JPG / WebP • max ~1MB</div>
          <div className="mt-2 flex items-center gap-2">
            <label className="px-3 py-1.5 rounded border cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              Choisir un fichier
            </label>
            {value && (
              <button type="button" className="text-sm text-red-600" onClick={onClear}>
                Retirer le logo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}