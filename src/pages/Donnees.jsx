// src/components/pages/Donnees.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import PasscodeGate, { isDonneesUnlocked } from "../components/PasscodeGate";
import { IconEdit, IconTrash } from "../components/ui/Icons";
import Toast from "../components/ui/Toast.jsx";
import ConfirmModal from "../components/ui/ConfirmModal.jsx";
import PageHeader from "../components/ui/PageHeader";

// Utilitaires
const euro = (n) => `${(Number(n)||0).toLocaleString("fr-FR")} €`;
const toCents = (v) => {
  const s = String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", ".");
  const f = parseFloat(s || "0");
  return Math.round(f * 100);
};
const fromCents = (c) => (Number(c || 0) / 100).toFixed(2);
function norm(s){
  return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
}

// ─── Header local de section ────────────────────────────────────────────────
function SectionHeader({ icon, title, sub }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ background: "rgba(225,6,0,0.08)" }}
      >
        {icon}
      </div>
      <div>
        <div className="font-bold text-gray-900">{title}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function Donnees() {

  // --- payment modes (moyens de règlement) ---
  const [paymentModes, setPaymentModes] = useState([]);
  const [pmCode, setPmCode] = useState("");
  const [pmLabel, setPmLabel] = useState("");
  const [pmEmoji, setPmEmoji] = useState("");

  // --- states ---
  const [cordages, setCordages] = useState([]);
  const [cordeurs, setCordeurs] = useState([]);
  const [statuts, setStatuts]   = useState([]);
  const [matrix, setMatrix]     = useState([]); // tarif_matrix

  const [loading, setLoading] = useState(false);
  // Toast (remplace le msg vert en haut)
const [toastOpen, setToastOpen] = useState(false);
const [toastTitle, setToastTitle] = useState("");
const [toastMessage, setToastMessage] = useState("");
const [toastVariant, setToastVariant] = useState("info"); // success | info | warning

function showToast(title, message = "", variant = "info") {
  setToastTitle(title);
  setToastMessage(message);
  setToastVariant(variant);
  setToastOpen(true);
}

// Confirm modal (remplace confirm())
const [confirmOpen, setConfirmOpen] = useState(false);
const [confirmConfig, setConfirmConfig] = useState({
  title: "Confirmer",
  message: "",
  icon: "⚠️",
  confirmLabel: "Confirmer",
  cancelLabel: "Annuler",
  danger: false,
});
const [confirmAction, setConfirmAction] = useState(null);

function askConfirm(config, action) {
  setConfirmConfig({
    title: config?.title ?? "Confirmer",
    message: config?.message ?? "",
    icon: config?.icon ?? "⚠️",
    confirmLabel: config?.confirmLabel ?? "Confirmer",
    cancelLabel: config?.cancelLabel ?? "Annuler",
    danger: !!config?.danger,
  });
  setConfirmAction(() => action);
  setConfirmOpen(true);
}

  // --- form: cordage ---
  const [cordageName, setCordageName] = useState("");
  const [cordageColor, setCordageColor] = useState("none");
  const [cordageIsBase, setCordageIsBase] = useState(false);
  const [cordageMarque, setCordageMarque] = useState("");
  // --- edit states (listes à droite) ---
  const [editCordageIdx, setEditCordageIdx] = useState(-1);
  const [editCordageVal, setEditCordageVal] = useState({
    cordage: "",
    Couleur: "none",
    is_base: false,
    gain_cents: null,
    gain_magasin_cents: null,
    marque: "",
  });
  const [editCordeurIdx, setEditCordeurIdx] = useState(-1);
  const [editCordeurVal, setEditCordeurVal] = useState("");

  // --- form: cordeur ---
  const [cordeurName, setCordeurName] = useState("");
  const [cordeurRemunMagasin, setCordeurRemunMagasin] = useState(false);

  const toggleRemunMagasin = async (cordeurName, currentValue) => {
  const { error } = await supabase
    .from("cordeur")
    .update({ remun_magasin: !currentValue })
    .eq("cordeur", cordeurName);

  if (error) {
    showToast("Erreur", "Erreur lors de la mise à jour", "warning");
    console.error(error);
    return;
  }

  // mise à jour locale (UX instantanée)
  setCordeurs((prev) =>
    prev.map((c) =>
      c.cordeur === cordeurName
        ? { ...c, remun_magasin: !currentValue }
        : c
    )
  );
};

  // --- form: statut ---
  const [newStatut, setNewStatut] = useState("");
  const [editStatutIdx, setEditStatutIdx] = useState(-1);
  const [editStatutVal, setEditStatutVal] = useState("");

  // --- form: règles tarifaires (affichées en €) ---
  const [T_sansBobine_base,      setT_sansBobine_base]      = useState("18");
  const [T_sansBobine_specific,  setT_sansBobine_specific]  = useState("20");
  const [T_bobineBase_base,      setT_bobineBase_base]      = useState("12");
  const [T_bobineSpec_specific,  setT_bobineSpec_specific]  = useState("14");
  const [T_express, setT_express] = useState("4");
  const [F_fourni12, setF_fourni12] = useState("10");
  const [F_fourni14, setF_fourni14] = useState("11.66");


  const locked = !isDonneesUnlocked();

  // --- load ---
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c1, c2, c3, c4, c5, c6, c7, c8] = await Promise.all([
          supabase.from("cordages").select("cordage, Couleur, is_base, gain_cents, gain_magasin_cents, marque").order("marque", { nullsFirst: false }).order("cordage"),
          supabase.from("cordeur").select("cordeur, remun_magasin").order("cordeur"),
          supabase.from("statuts").select("statut_id").order("statut_id"),
          supabase.from("tarif_matrix").select("*").order("id"),
          supabase.from("payment_modes").select("*").order("sort_order").order("label"),
          supabase.from("app_settings").select("*").eq("key","express_surcharge_cents").maybeSingle(),
          supabase.from("app_settings").select("*").eq("key","fourni_gain_12_cents").maybeSingle(),
          supabase.from("app_settings").select("*").eq("key","fourni_gain_14_cents").maybeSingle(),

        ]);
        if (c1.error) throw c1.error;
        if (c2.error) throw c2.error;
        if (c3.error) throw c3.error;
        if (c4.error) throw c4.error;
        if (c5.error) throw c5.error;
        if (!c6.error) {
          setT_express(fromCents(c6.data?.value_cents ?? 400));
        }
        setCordages(c1.data || []);
        setCordeurs(c2.data || []);
        setStatuts(c3.data || []);
        setMatrix(c4.data || []);
        setPaymentModes(c5.data || []);
        if (!c7.error) setF_fourni12(fromCents(c7.data?.value_cents ?? 1000));
        if (!c8.error) setF_fourni14(fromCents(c8.data?.value_cents ?? 1166));

        // initialiser les inputs tarifs depuis la matrice
        const mSansBase  = c4.data.find(r => r.bobine_base===false && r.bobine_specific===false && r.is_base===true);
        const mSansSpec  = c4.data.find(r => r.bobine_base===false && r.bobine_specific===false && r.is_base===false);
        const mBB_base   = c4.data.find(r => r.bobine_base===true && r.bobine_specific===false && r.is_base===true);
        const mBB_spec   = c4.data.find(r => r.bobine_base===true && r.bobine_specific===false && r.is_base===false);
        const mBS_base   = c4.data.find(r => r.bobine_base===true && r.bobine_specific===true && r.is_base===true);
        const mBS_spec   = c4.data.find(r => r.bobine_base===true && r.bobine_specific===true && r.is_base===false);

        if (mSansBase) setT_sansBobine_base(fromCents(mSansBase.price_cents));
        if (mSansSpec) setT_sansBobine_specific(fromCents(mSansSpec.price_cents));
        if (mBB_base)  setT_bobineBase_base(fromCents(mBB_base.price_cents));
        if (mBS_spec)  setT_bobineSpec_specific(fromCents(mBS_spec.price_cents));
      } catch (e) {
        console.error(e);
        showToast("Erreur", "Erreur de chargement: " + (e.message || e), "warning");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function requireUnlocked() {
  if (!isDonneesUnlocked()) {
    showToast(
      "Accès verrouillé",
      "Déverrouille la page (code) pour modifier les données.",
      "warning"
    );
    return false;
  }
  return true;
}

  // --- actions ---
  async function addPaymentMode(e){
  e?.preventDefault?.();
  if (!requireUnlocked()) return;

  if (!pmCode.trim() || !pmLabel.trim()){
    showToast("Erreur", "Code et libellé requis.", "warning");
    return;
  }

  const payload = {
    code: pmCode.trim(),
    label: pmLabel.trim(),
    emoji: pmEmoji || null,
    enabled: true,
    sort_order: (paymentModes[paymentModes.length-1]?.sort_order ?? 100) + 10,
  };

  const { data, error } = await supabase
    .from("payment_modes")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error){ showToast("Erreur", error.message, "warning"); return; }

  setPaymentModes(prev =>
    [...prev, data].sort((a,b)=> (a.sort_order-b.sort_order) || a.label.localeCompare(b.label))
  );

  setPmCode(""); setPmLabel(""); setPmEmoji("");
  showToast("✅ Ajout", "Moyen de règlement ajouté !", "success");
}

  async function togglePaymentMode(pm){
    if (!requireUnlocked()) return;
    const { data, error } = await supabase.from("payment_modes").update({ enabled: !pm.enabled }).eq("code", pm.code).select("*").maybeSingle();
    if (error){ showToast("Erreur", error.message, "warning"); return; }
    setPaymentModes(prev => prev.map(x => x.code===pm.code ? data : x));
  }

  async function updatePaymentMode(pm, patch){
    if (!requireUnlocked()) return;
    const { data, error } = await supabase.from("payment_modes").update(patch).eq("code", pm.code).select("*").maybeSingle();
    if (error){ showToast("Erreur", error.message, "warning"); return; }
    setPaymentModes(prev => prev.map(x => x.code===pm.code ? data : x));
  }

  async function movePaymentMode(pm, dir){
    if (!requireUnlocked()) return;
    const idx = paymentModes.findIndex(x => x.code === pm.code);
    const swap = paymentModes[idx + dir];
    if (idx<0 || !swap) return;
    const a = pm.sort_order, b = swap.sort_order;
    const { error: e1 } = await supabase.from("payment_modes").update({ sort_order: b }).eq("code", pm.code);
    const { error: e2 } = await supabase.from("payment_modes").update({ sort_order: a }).eq("code", swap.code);
    if (e1 || e2){ showToast("Erreur", "Réordonnancement refusé", "warning"); return; }
    const arr = [...paymentModes];
    [arr[idx], arr[idx+dir]] = [arr[idx+dir], arr[idx]];
    setPaymentModes(arr);
  }

  async function deletePaymentMode(code){
  if (!requireUnlocked()) return;

  askConfirm(
    {
      title: "Supprimer ce moyen de règlement ?",
      message: `Tu vas supprimer "${code}". Cette action est irréversible.`,
      icon: "🗑️",
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      danger: true,
    },
    async () => {
      const { error } = await supabase.from("payment_modes").delete().eq("code", code);
      if (error){
        showToast("Erreur", error.message, "warning");
        return;
      }
      setPaymentModes(prev => prev.filter(x => x.code !== code));
      showToast("🗑️ Suppression", "Moyen de règlement supprimé.", "success");
    }
  );
}

  async function addCordage() {
    if (!requireUnlocked()) return;
    if (!cordageName.trim()) { showToast("Erreur", "Nom du cordage requis", "warning"); return; }
    const payload = {
      cordage: cordageName.trim(),
      Couleur: (cordageColor || "none").trim(),
      is_base: !!cordageIsBase,
      marque: cordageMarque.trim() || null,
    };
    const { error } = await supabase.from("cordages").insert(payload);
    if (error) { showToast("Erreur", error.message, "warning"); return; }
    setCordageName(""); setCordageColor("none"); setCordageIsBase(false); setCordageMarque("");
    setCordages(prev => [...prev, payload].sort((a,b) => {
      const ma = (a.marque||"zzz").toLowerCase(), mb = (b.marque||"zzz").toLowerCase();
      if (ma !== mb) return ma.localeCompare(mb,"fr");
      return a.cordage.localeCompare(b.cordage,"fr");
    }));
    showToast("✅ Ajout", "Cordage ajouté !", "success");
  }

  async function addCordeur() {
    if (!requireUnlocked()) return;
    if (!cordeurName.trim()) { showToast("Erreur", "Nom du cordeur requis", "warning"); return; }
    const payload = { cordeur: cordeurName.trim(), remun_magasin: !!cordeurRemunMagasin };
    const { error } = await supabase.from("cordeur").insert(payload);
    if (error) { showToast("Erreur", error.message, "warning"); return; }
    setCordeurs(prev => [...prev, payload].sort((a,b)=>a.cordeur.localeCompare(b.cordeur)));
    setCordeurName("");
    setCordeurRemunMagasin(false);
    showToast("✅ Ajout", "Cordeur ajouté !", "success");
  }

  async function addStatut() {
    if (!requireUnlocked()) return;
    if (!newStatut.trim()) { showToast("Erreur", "Libellé requis", "warning"); return; }
    const payload = { statut_id: newStatut.trim() };
    const { error } = await supabase.from("statuts").insert(payload);
    if (error) { showToast("Erreur", error.message, "warning"); return; }
    setStatuts(prev => [...prev, payload].sort((a,b)=>a.statut_id.localeCompare(b.statut_id)));
    setNewStatut("");
    showToast("✅ Ajout", "Statut ajouté !", "success");
  }

  // ---- Cordages : edit + delete ----
async function saveEditCordage(oldName) {
  if (!requireUnlocked()) return;

  const payload = {
    cordage: (editCordageVal.cordage || "").trim(),
    Couleur: (editCordageVal.Couleur || "none").trim(),
    is_base: !!editCordageVal.is_base,
    gain_cents: (typeof editCordageVal.gain_cents === "number" ? editCordageVal.gain_cents : null),
    gain_magasin_cents: (typeof editCordageVal.gain_magasin_cents === "number" ? editCordageVal.gain_magasin_cents : null),
    marque: (editCordageVal.marque || "").trim() || null,
  };

  if (!payload.cordage) { showToast("Erreur", "Nom du cordage requis", "warning"); return; }

  const { error } = await supabase
    .from("cordages")
    .update(payload)
    .eq("cordage", oldName);

  if (error) { showToast("Erreur", error.message, "warning"); return; }

  setCordages(prev =>
    prev
      .map(c => c.cordage === oldName ? { ...c, ...payload } : c)
      .sort((a,b) => {
        const ma = (a.marque||"zzz").toLowerCase(), mb = (b.marque||"zzz").toLowerCase();
        if (ma !== mb) return ma.localeCompare(mb,"fr");
        return a.cordage.localeCompare(b.cordage,"fr");
      })
  );

  setEditCordageIdx(-1);
  setEditCordageVal({ cordage:"", Couleur:"none", is_base:false, gain_cents:null, gain_magasin_cents:null, marque:"" });
  showToast("✅ Modification", "Cordage modifié !", "success");
}

async function deleteCordage(name) {
  if (!requireUnlocked()) return;

  askConfirm(
    {
      title: "Supprimer ce cordage ?",
      message: `Tu vas supprimer "${name}". Cette action est irréversible.`,
      icon: "🗑️",
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      danger: true,
    },
    async () => {
      const { error } = await supabase.from("cordages").delete().eq("cordage", name);
      if (error) {
        showToast("Erreur", "Suppression impossible: " + error.message, "warning");
        return;
      }
      setCordages((prev) => prev.filter((c) => c.cordage !== name));
      showToast("🗑️ Suppression", "Cordage supprimé.", "success");
    }
  );
}

// ---- Cordeurs : edit + delete ----
async function saveEditCordeur(oldName) {
    if (!requireUnlocked()) return;
   const next = (editCordeurVal || "").trim();
   if (!next) { showToast("Erreur", "Nom requis", "warning"); return; }
   const { error } = await supabase.from("cordeur").update({ cordeur: next }).eq("cordeur", oldName);
   if (error) { showToast("Erreur", error.message, "warning"); return; }
   setCordeurs(prev =>
    prev
         .map(c => c.cordeur === oldName ? { ...c, cordeur: next } : c)
         .sort((a,b)=>a.cordeur.localeCompare(b.cordeur))
     );
   setEditCordeurIdx(-1); setEditCordeurVal("");
   showToast("✅ Modification", "Cordeur modifié !", "success");
}
async function deleteCordeur(name) {
  if (!requireUnlocked()) return;

  askConfirm(
    {
      title: "Supprimer ce cordeur ?",
      message: `Tu vas supprimer "${name}". Cette action est irréversible.`,
      icon: "🗑️",
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      danger: true,
    },
    async () => {
      const { error } = await supabase.from("cordeur").delete().eq("cordeur", name);
      if (error) { showToast("Erreur", error.message, "warning"); return; }
      setCordeurs(prev => prev.filter(c => c.cordeur !== name));
      showToast("🗑️ Suppression", "Cordeur supprimé.", "success");
    }
  );
}

// ---- Statuts : delete ----
async function deleteStatut(name) {
  if (!requireUnlocked()) return;

  askConfirm(
    {
      title: "Supprimer ce statut ?",
      message: `Tu vas supprimer "${name}". Cette action est irréversible.`,
      icon: "🗑️",
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      danger: true,
    },
    async () => {
      const { error } = await supabase.from("statuts").delete().eq("statut_id", name);
      if (error) { showToast("Erreur", error.message, "warning"); return; }
      setStatuts(prev => prev.filter(s => s.statut_id !== name));
      showToast("🗑️ Suppression", "Statut supprimé.", "success");
    }
  );
}

async function saveEditStatut(oldVal) {
    if (!requireUnlocked()) return;
    const next = editStatutVal.trim();
    if (!next) { showToast("Erreur", "Libellé requis", "warning"); return; }
    const { error } = await supabase.from("statuts")
      .update({ statut_id: next })
      .eq("statut_id", oldVal);
    if (error) {
      showToast("Erreur", "Impossible de renommer (contrainte de clé étrangère ?)\n" + error.message +
            "\nAstuce: ajoute le nouveau statut puis migre manuellement les lignes si besoin.", "warning");
      return;
    }
    setStatuts(prev => prev.map(s => s.statut_id===oldVal ? {statut_id: next} : s)
      .sort((a,b)=>a.statut_id.localeCompare(b.statut_id)));
    setEditStatutIdx(-1); setEditStatutVal("");
    showToast("✅ Modification", "Statut modifié !", "success");
}

async function saveTarifs() {
  if (!requireUnlocked()) return;

  showToast("⏳ Enregistrement", "Enregistrement en cours...", "info");
  setLoading(true);

  try {
    const { data: expData, error: expressError } = await supabase
      .from("app_settings")
      .upsert({ key: "express_surcharge_cents", value_cents: toCents(T_express) })
      .select("key, value_cents");

    if (expressError) {
      showToast("Erreur", "Erreur mise à jour express: " + expressError.message, "warning");
      return;
    }
    if (!expData || expData.length === 0) {
      showToast("Erreur", "Express non enregistré (0 ligne modifiée). Vérifie RLS / table app_settings.", "warning");
      return;
    }

const { data: f12, error: eF12 } = await supabase
  .from("app_settings")
  .upsert({ key: "fourni_gain_12_cents", value_cents: toCents(F_fourni12) })
  .select("key, value_cents");

if (eF12 || !f12?.length) {
  showToast("Erreur", "Erreur mise à jour fourni (12€): " + (eF12?.message || "0 ligne"), "warning");
  return;
}

const { data: f14, error: eF14 } = await supabase
  .from("app_settings")
  .upsert({ key: "fourni_gain_14_cents", value_cents: toCents(F_fourni14) })
  .select("key, value_cents");

if (eF14 || !f14?.length) {
  showToast("Erreur", "Erreur mise à jour fourni (14€): " + (eF14?.message || "0 ligne"), "warning");
  return;
}

    const batch = [
      { match: { bobine_base: false, bobine_specific: false, is_base: true  }, price_cents: toCents(T_sansBobine_base) },
      { match: { bobine_base: false, bobine_specific: false, is_base: false }, price_cents: toCents(T_sansBobine_specific) },
      { match: { bobine_base: true,  bobine_specific: false, is_base: true  }, price_cents: toCents(T_bobineBase_base) },
      { match: { bobine_base: true,  bobine_specific: true,  is_base: false }, price_cents: toCents(T_bobineSpec_specific) },
    ];

    for (const row of batch) {
      const { data: updatedRows, error } = await supabase
        .from("tarif_matrix")
        .update({ price_cents: row.price_cents })
        .eq("bobine_base", row.match.bobine_base)
        .eq("bobine_specific", row.match.bobine_specific)
        .eq("is_base", row.match.is_base)
        .select("id, price_cents");

      if (error) {
        showToast("Erreur", "Erreur mise à jour tarifs: " + error.message, "warning");
        return;
      }

      if (!updatedRows || updatedRows.length === 0) {
        showToast("Erreur", "Aucune ligne tarif_matrix modifiée pour : " +
          JSON.stringify(row.match) +
          "\n=> La ligne n'existe pas en base ou les colonnes/valeurs ne matchent pas.", "warning");
        return;
      }
    }

    showToast("✅ Enregistrement", "Tarifs enregistrés !", "success");
    const { data, error } = await supabase.from("tarif_matrix").select("*").order("id");
    if (!error) setMatrix(data || []);
  } finally {
    setLoading(false);
  }
}

// --- vues auxiliaires ---
const tarifsPreview = useMemo(() => {
    const key = (bBase, bSpec, isBase) => `${bBase}-${bSpec}-${isBase}`;
    const map = Object.fromEntries((matrix||[]).map(r => [key(r.bobine_base, r.bobine_specific, r.is_base), r.price_cents]));
    return [
      { label: "Sans bobine • cordage basique",     val: map["false-false-true"]  },
      { label: "Sans bobine • cordage spécifique",  val: map["false-false-false"] },
      { label: "Bobine base • cordage basique",     val: map["true-false-true"]   },
      { label: "Bobine base • cordage spécifique",  val: map["true-false-false"]  },
      { label: "Base+Spécifique • cordage basique", val: map["true-true-true"]    },
      { label: "Base+Spécifique • cordage spécifique", val: map["true-true-false"]},
    ];
}, [matrix]);

return (
  <div className="p-6">
  <PasscodeGate ttlHours={12}>
    {({ lock }) => (
    <>
    <div className="space-y-6">
      <PageHeader
        title="Données"
        description="Configurez les cordages, tarifs, modes de paiement et paramètres de l'application."
        action={
          <button
            onClick={lock}
            title="Verrouiller la page"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 bg-white"
          >
            🔒 Verrouiller
          </button>
        }
      />
      {loading && <div className="text-sm text-gray-400">Chargement…</div>}

      {/* ── 1) Cordages ── */}
      <section className="card p-4">
        <SectionHeader icon="🏸" title="Cordages" sub="Gérez les cordages disponibles et leurs paramètres de gain" />

        <div className="mt-4 grid md:grid-cols-2 gap-6">
          {/* Formulaire ajout */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">Ajouter un cordage</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Marque</label>
                <input className="input-field" placeholder="ex: Yonex, Babolat…" value={cordageMarque} onChange={(e)=>setCordageMarque(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nom</label>
                <input className="input-field" placeholder="ex: BG 65" value={cordageName} onChange={(e)=>setCordageName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Couleur</label>
                <input className="input-field" placeholder="none" value={cordageColor} onChange={(e)=>setCordageColor(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 self-end pb-1">
                <input type="checkbox" checked={cordageIsBase} onChange={e=>setCordageIsBase(e.target.checked)} />
                Cordage basique
              </label>
              <div className="flex items-end">
                <button className="btn-red" onClick={addCordage}>+ Ajouter</button>
              </div>
            </div>
          </div>

          {/* Liste */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Liste <span className="text-gray-400 font-normal">({cordages.length})</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto pr-1">
              {cordages.map((c, i) => (
                <div key={c.cordage} className="py-2.5 flex items-start justify-between gap-3">
                  {editCordageIdx===i ? (
                    <div className="flex-1 grid sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Marque</label>
                        <input className="input-field" defaultValue={c.marque || ""} onChange={(e)=>setEditCordageVal(v=>({...v, marque:e.target.value}))} placeholder="ex: Yonex" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Nom</label>
                        <input className="input-field" defaultValue={c.cordage} onChange={(e)=>setEditCordageVal(v=>({...v, cordage:e.target.value}))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Couleur</label>
                        <input className="input-field" defaultValue={c.Couleur || "none"} onChange={(e)=>setEditCordageVal(v=>({...v, Couleur:e.target.value}))} />
                      </div>
                      <label className="flex items-center gap-2 text-sm self-center">
                        <input type="checkbox" defaultChecked={!!c.is_base} onChange={(e)=>setEditCordageVal(v=>({...v, is_base:e.target.checked}))} />
                        basique
                      </label>
                      <div>
                        <label className="text-xs text-gray-500">Gain tournoi (€)</label>
                        <input type="number" step="0.01" min="0" className="input-field" defaultValue={(c.gain_cents ?? 0) / 100}
                          onChange={(e)=> { const v = parseFloat(e.target.value || "0"); setEditCordageVal(vv => ({ ...vv, gain_cents: isNaN(v) ? null : Math.round(v*100) })); }} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Gain magasin (€)</label>
                        <input type="number" step="0.01" min="0" className="input-field" defaultValue={(c.gain_magasin_cents ?? 0) / 100}
                          onChange={(e)=> { const v = parseFloat(e.target.value || "0"); setEditCordageVal(vv => ({ ...vv, gain_magasin_cents: isNaN(v) ? null : Math.round(v*100) })); }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {c.marque && <span className="text-gray-400 font-normal mr-1">{c.marque} •</span>}
                        {c.cordage}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {c.Couleur && c.Couleur !== "none" && (
                          <span className="text-xs text-gray-500">🎨 {c.Couleur}</span>
                        )}
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.is_base ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                          {c.is_base ? "basique" : "spécifique"}
                        </span>
                        {typeof c.gain_cents === "number" && (
                          <span className="text-xs text-gray-400">T: {(c.gain_cents/100).toLocaleString("fr-FR")}€</span>
                        )}
                        {typeof c.gain_magasin_cents === "number" && (
                          <span className="text-xs text-gray-400">M: {(c.gain_magasin_cents/100).toLocaleString("fr-FR")}€</span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {editCordageIdx===i ? (
                      <>
                        <button className="icon-btn" title="Enregistrer" onClick={()=>saveEditCordage(c.cordage)}>💾</button>
                        <button className="icon-btn" title="Annuler" onClick={() => { setEditCordageIdx(-1); setEditCordageVal({ cordage:"", Couleur:"none", is_base:false, gain_cents:null, gain_magasin_cents:null, marque:"" }); }}>✖</button>
                      </>
                    ) : (
                      <>
                        <button className="icon-btn" title="Éditer" onClick={()=>{ setEditCordageIdx(i); setEditCordageVal({ cordage: c.cordage, Couleur: c.Couleur || "none", is_base: !!c.is_base, gain_cents: (typeof c.gain_cents === "number" ? c.gain_cents : null), gain_magasin_cents: (typeof c.gain_magasin_cents === "number" ? c.gain_magasin_cents : null), marque: c.marque || "" }); }}><IconEdit /></button>
                        <button className="icon-btn-red" title="Supprimer" onClick={()=>deleteCordage(c.cordage)}><IconTrash /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {cordages.length===0 && <div className="py-6 text-sm text-gray-400 text-center">Aucun cordage enregistré.</div>}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2) Cordeurs ── */}
      <section className="card p-4">
        <SectionHeader icon="🧑‍🔧" title="Cordeurs" sub="Gérez les cordeurs et leurs paramètres de rémunération" />

        <div className="mt-4 grid md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">Ajouter un cordeur</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nom</label>
                <input className="input-field" placeholder="ex: Vincenzo" value={cordeurName} onChange={(e)=>setCordeurName(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={cordeurRemunMagasin} onChange={(e) => setCordeurRemunMagasin(e.target.checked)} />
                  Rémunéré en magasin
                </label>
              </div>
              <div className="flex items-end">
                <button className="btn-red" onClick={addCordeur}>+ Ajouter</button>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Liste <span className="text-gray-400 font-normal">({cordeurs.length})</span>
            </div>
            <div className="divide-y divide-gray-100">
              {cordeurs.map((c, i) => (
                <div key={c.cordeur} className="py-2.5 flex items-center justify-between gap-3">
                  {editCordeurIdx===i ? (
                    <input className="input-field flex-1" defaultValue={c.cordeur} onChange={(e)=>setEditCordeurVal(e.target.value)} />
                  ) : (
                    <div className="flex-1 flex items-center gap-3">
                      <span className="font-medium text-sm">{c.cordeur}</span>
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={!!c.remun_magasin} onChange={() => toggleRemunMagasin(c.cordeur, c.remun_magasin)} />
                        <span className={c.remun_magasin ? "text-green-600 font-semibold" : ""}>Magasin</span>
                      </label>
                    </div>
                  )}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {editCordeurIdx===i ? (
                      <>
                        <button className="icon-btn" title="Enregistrer" onClick={()=>saveEditCordeur(c.cordeur)}>💾</button>
                        <button className="icon-btn" title="Annuler" onClick={()=>{setEditCordeurIdx(-1); setEditCordeurVal("");}}>✖</button>
                      </>
                    ) : (
                      <>
                        <button className="icon-btn" title="Éditer" onClick={()=>{setEditCordeurIdx(i); setEditCordeurVal(c.cordeur);}}><IconEdit /></button>
                        <button className="icon-btn-red" title="Supprimer" onClick={()=>deleteCordeur(c.cordeur)}><IconTrash /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {cordeurs.length===0 && <div className="py-6 text-sm text-gray-400 text-center">Aucun cordeur enregistré.</div>}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3) Statuts ── */}
      <section className="card p-4">
        <SectionHeader icon="🏷️" title="Statuts" sub="Gérez les statuts de suivi des raquettes" />

        <div className="mt-4 grid md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="block text-xs text-gray-500 mb-1">Ajouter un statut</label>
            <div className="flex gap-2">
              <input className="input-field" placeholder='ex: "A RÉGLER"' value={newStatut} onChange={(e)=>setNewStatut(e.target.value)} />
              <button className="btn-red shrink-0" onClick={addStatut}>+ Ajouter</button>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Liste <span className="text-gray-400 font-normal">({statuts.length})</span>
            </div>
            <div className="space-y-1.5">
              {statuts.map((s, i) => (
                <div key={s.statut_id} className="flex items-center gap-2">
                  {editStatutIdx===i ? (
                    <>
                      <input className="input-field flex-1" defaultValue={s.statut_id} onChange={(e)=>setEditStatutVal(e.target.value)} />
                      <button className="icon-btn" onClick={()=>saveEditStatut(s.statut_id)}>💾</button>
                      <button className="icon-btn" onClick={()=>{setEditStatutIdx(-1); setEditStatutVal("");}}>✖</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium px-3 py-1.5 bg-gray-100 rounded-lg truncate">{s.statut_id}</span>
                      <button className="icon-btn" title="Éditer" onClick={()=>{setEditStatutIdx(i); setEditStatutVal(s.statut_id);}}><IconEdit /></button>
                      <button className="icon-btn-red" title="Supprimer" onClick={()=>deleteStatut(s.statut_id)}><IconTrash /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-400">Si la base a une contrainte FK stricte, le renommage peut être refusé.</div>
          </div>
        </div>
      </section>

      {/* ── 4) Règles tarifaires ── */}
      <section className="card p-4">
        <SectionHeader icon="💰" title="Règles tarifaires" sub="Définissez les prix selon le type de cordage et les bobines du club" />

        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sans bobine • cordage <b>basique</b></label>
            <input className="input-field" value={T_sansBobine_base} onChange={(e)=>setT_sansBobine_base(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sans bobine • cordage <b>spécifique</b></label>
            <input className="input-field" value={T_sansBobine_specific} onChange={(e)=>setT_sansBobine_specific(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bobine base • cordage <b>basique</b></label>
            <input className="input-field" value={T_bobineBase_base} onChange={(e)=>setT_bobineBase_base(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bobine specific • cordage <b>spécifique</b></label>
            <input className="input-field" value={T_bobineSpec_specific} onChange={(e)=>setT_bobineSpec_specific(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Supplément <b>Express</b></label>
            <input className="input-field" value={T_express} onChange={(e)=>setT_express(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fourni • tarif <b>12€</b> → gain cordeur</label>
            <input className="input-field" value={F_fourni12} onChange={(e)=>setF_fourni12(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fourni • tarif <b>14€</b> → gain cordeur</label>
            <input className="input-field" value={F_fourni14} onChange={(e)=>setF_fourni14(e.target.value)} />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button className="btn-red" onClick={saveTarifs}>💾 Enregistrer les tarifs</button>
          <span className="text-xs text-gray-400">Montants en € TTC • stockés en centimes dans <code>tarif_matrix</code></span>
        </div>

        <div className="mt-4 bg-gray-50 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Aperçu actuel</div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0">
            {tarifsPreview.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-600 truncate mr-2">{l.label}</span>
                <span className="font-bold text-gray-900 shrink-0">{euro(Number(l.val||0)/100)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5) Moyens de règlement ── */}
      <section className="card p-4">
        <SectionHeader icon="💳" title="Moyens de règlement" sub="Gérez les modes de paiement disponibles à la saisie" />

        <form onSubmit={addPaymentMode} className="mt-4 bg-gray-50 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">Ajouter un moyen</div>
          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Code</label>
              <input className="input-field" placeholder="ex: Paypal" value={pmCode} onChange={(e)=>setPmCode(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Libellé</label>
              <input className="input-field" placeholder="ex: PayPal" value={pmLabel} onChange={(e)=>setPmLabel(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Emoji (optionnel)</label>
              <input className="input-field" placeholder="ex: 🅿️" value={pmEmoji} onChange={(e)=>setPmEmoji(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-red">+ Ajouter</button>
            </div>
          </div>
        </form>

        <div className="mt-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">
            Liste <span className="text-gray-400 font-normal">({paymentModes.length})</span>
          </div>

          {/* Desktop */}
          <div className="divide-y divide-gray-100 hidden md:block">
            {paymentModes.map((pm, i) => (
              <div key={pm.code} className="py-2.5 flex items-center gap-3">
                <span className="w-7 text-xl text-center shrink-0">{pm.emoji || "—"}</span>
                <div className="min-w-0 flex-1">
                  <input className="input-field" value={pm.label} onChange={(e)=>updatePaymentMode(pm, { label: e.target.value })} />
                </div>
                <input className="input-field w-16 shrink-0" value={pm.emoji || ""} onChange={(e)=>updatePaymentMode(pm, { emoji: e.target.value || null })} title="Emoji" />
                <button type="button" onClick={()=>togglePaymentMode(pm)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${pm.enabled ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                  {pm.enabled ? "✓ Activé" : "Caché"}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="icon-btn" disabled={i===0} onClick={()=>movePaymentMode(pm,-1)} title="Monter">↑</button>
                  <button className="icon-btn" disabled={i===paymentModes.length-1} onClick={()=>movePaymentMode(pm,1)} title="Descendre">↓</button>
                  <button className="icon-btn-red" onClick={()=>deletePaymentMode(pm.code)} title="Supprimer"><IconTrash /></button>
                </div>
              </div>
            ))}
            {paymentModes.length===0 && <div className="py-6 text-sm text-gray-400 text-center">Aucun moyen de règlement.</div>}
          </div>

          {/* Mobile */}
          <div className="space-y-2 md:hidden">
            {paymentModes.map((pm, i) => (
              <div key={pm.code} className="rounded-xl border border-gray-100 p-3 bg-white">
                <div className="flex items-center gap-3">
                  <span className="text-xl w-7 text-center shrink-0">{pm.emoji || "—"}</span>
                  <div className="font-medium text-sm truncate flex-1">{pm.label || pm.code}</div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={()=>togglePaymentMode(pm)}
                      className={`px-2 py-1 rounded-lg border text-xs font-medium ${pm.enabled ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                      {pm.enabled ? "✓" : "—"}
                    </button>
                    <button className="icon-btn" disabled={i===0} onClick={()=>movePaymentMode(pm,-1)}>↑</button>
                    <button className="icon-btn" disabled={i===paymentModes.length-1} onClick={()=>movePaymentMode(pm,1)}>↓</button>
                    <button className="icon-btn-red" onClick={()=>deletePaymentMode(pm.code)}><IconTrash /></button>
                  </div>
                </div>
              </div>
            ))}
            {paymentModes.length===0 && <div className="py-3 text-sm text-gray-400 text-center">Aucun moyen.</div>}
          </div>
        </div>
      </section>
    </div>
    <Toast open={toastOpen} onClose={() => setToastOpen(false)} title={toastTitle} message={toastMessage} variant={toastVariant} />
    <ConfirmModal
      open={confirmOpen}
      title={confirmConfig.title}
      message={confirmConfig.message}
      icon={confirmConfig.icon}
      confirmLabel={confirmConfig.confirmLabel}
      cancelLabel={confirmConfig.cancelLabel}
      danger={confirmConfig.danger}
      onCancel={() => { setConfirmOpen(false); setConfirmAction(null); }}
      onConfirm={async () => { setConfirmOpen(false); const fn = confirmAction; setConfirmAction(null); await fn?.(); }}
    />
  </>
  )}
  </PasscodeGate>
  </div>
);
}
