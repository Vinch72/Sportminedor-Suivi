// src/components/pages/Donnees.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import PasscodeGate, { isDonneesUnlocked } from "../components/PasscodeGate";
import { IconEdit, IconTrash } from "../components/ui/Icons";
import Toast from "../components/ui/Toast.jsx";
import ConfirmModal from "../components/ui/ConfirmModal.jsx";

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
  const [cordageColor, setCordageColor] = useState("none"); // colonne Supabase: "Couleur"
  const [cordageIsBase, setCordageIsBase] = useState(false);
  // --- edit states (listes à droite) ---
  const [editCordageIdx, setEditCordageIdx] = useState(-1);
  const [editCordageVal, setEditCordageVal] = useState({
    cordage: "",
    Couleur: "none",
    is_base: false,
    gain_cents: null,
    gain_magasin_cents: null,
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
  // On mappe les 4 montants "clés" lisibles :
  //  A) Sans bobine (club: base=false, specific=false)
  //     - cordage basique  => 18€
  //     - cordage spécifique => 20€
  //  B) Club a bobine "base"        (base=true,  specific=false)
  //     - cordage basique  => 12€
  //     - cordage spécifique => 20€
  //  C) Club a bobine base & specific (base=true, specific=true)
  //     - cordage basique  => 12€
  //     - cordage spécifique => 14€
  // On expose les 4 valeurs distinctes que tu veux pouvoir modifier :
  const [T_sansBobine_base,      setT_sansBobine_base]      = useState("18");
  const [T_sansBobine_specific,  setT_sansBobine_specific]  = useState("20");
  const [T_bobineBase_base,      setT_bobineBase_base]      = useState("12");
  const [T_bobineSpec_specific,  setT_bobineSpec_specific]  = useState("14");
  const [T_express, setT_express] = useState("4");
  const [F_fourni12, setF_fourni12] = useState("10");     // 12€ -> 10€
  const [F_fourni14, setF_fourni14] = useState("11.66");  // 14€ -> 11,66€


  const locked = !isDonneesUnlocked();

  // --- load ---
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c1, c2, c3, c4, c5, c6, c7, c8] = await Promise.all([
          supabase.from("cordages").select("cordage, Couleur, is_base, gain_cents, gain_magasin_cents").order("cordage"),
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
        // sans bobine (false,false)
        const mSansBase  = c4.data.find(r => r.bobine_base===false && r.bobine_specific===false && r.is_base===true);
        const mSansSpec  = c4.data.find(r => r.bobine_base===false && r.bobine_specific===false && r.is_base===false);
        // bobine base (true,false)
        const mBB_base   = c4.data.find(r => r.bobine_base===true && r.bobine_specific===false && r.is_base===true);
        const mBB_spec   = c4.data.find(r => r.bobine_base===true && r.bobine_specific===false && r.is_base===false);
        // bobine base+spec (true,true)
        const mBS_base   = c4.data.find(r => r.bobine_base===true && r.bobine_specific===true && r.is_base===true);
        const mBS_spec   = c4.data.find(r => r.bobine_base===true && r.bobine_specific===true && r.is_base===false);

        if (mSansBase) setT_sansBobine_base(fromCents(mSansBase.price_cents));
        if (mSansSpec) setT_sansBobine_specific(fromCents(mSansSpec.price_cents));
        if (mBB_base)  setT_bobineBase_base(fromCents(mBB_base.price_cents));
        if (mBS_spec)  setT_bobineSpec_specific(fromCents(mBS_spec.price_cents));
        // (les deux autres cas restent inchangés selon ta règle actuelle)
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
    };
    const { error } = await supabase.from("cordages").insert(payload);
    if (error) { showToast("Erreur", error.message, "warning");
 return; }
    setCordageName(""); setCordageColor("none"); setCordageIsBase(false);
    setCordages(prev => [...prev, payload].sort((a,b)=>a.cordage.localeCompare(b.cordage)));
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
      .sort((a,b) => a.cordage.localeCompare(b.cordage))
  );

  setEditCordageIdx(-1);
  setEditCordageVal({ cordage:"", Couleur:"none", is_base:false, gain_cents:null, gain_magasin_cents:null });
  showToast("✅ Modification", "Cordage modifié !", "success");
}

// ---- Cordages : edit + delete ----
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
    // tentative d'UPDATE direct ; si FK strict sans ON UPDATE CASCADE, Postgres refusera.
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
    // 1) Sauvegarde Express
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

    // 1bis) Sauvegarde règles "fourni"
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

    // 2) Maj des tarifs (on force un retour de lignes avec .select())
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

      // ✅ si 0 ligne, on le dit clairement
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
    // reconstruit un aperçu lisible depuis la matrice
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
    <PasscodeGate ttlHours={12}>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Données</h1>
        {loading && <div className="text-sm text-gray-500">Chargement…</div>}

    {/* 1) Ajouter un cordage */}
    <section className="card p-4">
      <div className="section-bar">Cordages</div>

      <div className="mt-3 grid md:grid-cols-2 gap-6">
        {/* Colonne gauche : ajout */}
        <div>
          <div className="text-sm font-medium mb-2">Ajouter un cordage</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Nom</label>
              <input className="input input-bordered w-full text-black bg-white"
                placeholder="ex: BG 65"
                value={cordageName}
                onChange={(e)=>setCordageName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Couleur</label>
              <input className="input input-bordered w-full text-black bg-white"
                placeholder="none"
                value={cordageColor}
                onChange={(e)=>setCordageColor(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cordageIsBase} onChange={e=>setCordageIsBase(e.target.checked)} />
              Cordage basique
            </label>
            <div className="flex items-end">
              <button className="btn-red px-4 py-2 rounded-xl text-white" style={{background:"#E10600"}} onClick={addCordage}>
                Ajouter
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">Écrit dans <code>cordages(cordage, Couleur, is_base)</code>.</div>
        </div>

        {/* Colonne droite : liste + edit/delete */}
        <div>
          <div className="text-sm font-medium mb-2">Liste des cordages</div>
          <div className="divide-y">
            {cordages.map((c, i)=>(
              <div key={c.cordage} className="py-2 flex items-center justify-between gap-3">
                {editCordageIdx===i ? (
                  <div className="flex-1 grid sm:grid-cols-5 gap-2">
                    <input className="input input-bordered text-black bg-white"
                      defaultValue={c.cordage}
                      onChange={(e)=>setEditCordageVal(v=>({...v, cordage:e.target.value}))}
                    />
                    <input className="input input-bordered text-black bg-white"
                      defaultValue={c.Couleur || "none"}
                      onChange={(e)=>setEditCordageVal(v=>({...v, Couleur:e.target.value}))}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox"
                        defaultChecked={!!c.is_base}
                        onChange={(e)=>setEditCordageVal(v=>({...v, is_base:e.target.checked}))}
                      />
                      basique
                    </label>
                    <div>
  <label className="text-xs text-gray-600">Gain tournoi (€)</label>
  <input
    type="number" step="0.01" min="0"
    className="input input-bordered text-black bg-white w-full"
    defaultValue={(c.gain_cents ?? 0) / 100}
    onChange={(e)=> {
      const v = parseFloat(e.target.value || "0");
      setEditCordageVal(vv => ({ ...vv, gain_cents: isNaN(v) ? null : Math.round(v*100) }));
    }}
  />
</div>

<div>
  <label className="text-xs text-gray-600">Gain magasin (€)</label>
  <input
    type="number" step="0.01" min="0"
    className="input input-bordered text-black bg-white w-full"
    defaultValue={(c.gain_magasin_cents ?? 0) / 100}
    onChange={(e)=> {
      const v = parseFloat(e.target.value || "0");
      setEditCordageVal(vv => ({ ...vv, gain_magasin_cents: isNaN(v) ? null : Math.round(v*100) }));
    }}
  />
</div>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.cordage}</div>
                    <div className="text-xs text-gray-600">
                      Couleur: <b>{c.Couleur || "none"}</b> • Type: <b>{c.is_base ? "basique" : "spécifique"}</b>
                      {typeof c.gain_cents === "number" && (
  <> • Gain tournoi: <b>{(c.gain_cents/100).toLocaleString("fr-FR")} €</b></>
)}
{typeof c.gain_magasin_cents === "number" && (
  <> • Gain magasin: <b>{(c.gain_magasin_cents/100).toLocaleString("fr-FR")} €</b></>
)}
                    </div>
                  </div>
                )}

                <div className="shrink-0 flex items-center gap-2">
                  {editCordageIdx===i ? (
                    <>
                      <button className="icon-btn" title="Enregistrer" onClick={()=>saveEditCordage(c.cordage)}>💾</button>
                      <button className="icon-btn" title="Annuler" onClick={() => {
  setEditCordageIdx(-1);
  setEditCordageVal({ cordage:"", Couleur:"none", is_base:false, gain_cents:null, gain_magasin_cents:null });
}}>✖</button>
                    </>
                  ) : (
                    <>
                      <button className="icon-btn" title="Éditer" onClick={()=>{setEditCordageIdx(i); setEditCordageVal({
  cordage: c.cordage,
  Couleur: c.Couleur || "none",
  is_base: !!c.is_base,
  gain_cents: (typeof c.gain_cents === "number" ? c.gain_cents : null),
  gain_magasin_cents: (typeof c.gain_magasin_cents === "number" ? c.gain_magasin_cents : null),
})}}><IconEdit /></button>
                      <button className="icon-btn-red" title="Supprimer" onClick={()=>deleteCordage(c.cordage)}><IconTrash /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {cordages.length===0 && <div className="py-4 text-sm text-gray-500">Aucun cordage.</div>}
          </div>
        </div>
      </div>
    </section>

    {/* 2) Ajouter un cordeur */}
    <section className="card p-4">
      <div className="section-bar">Cordeurs</div>

      <div className="mt-3 grid md:grid-cols-2 gap-6">
        {/* gauche : ajout */}
        <div>
          <div className="text-sm font-medium mb-2">Ajouter un cordeur</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Nom</label>
              <input className="input input-bordered w-full text-black bg-white"
                placeholder="ex: Vincenzo"
                value={cordeurName}
                onChange={(e)=>setCordeurName(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
    <input
      type="checkbox"
      checked={cordeurRemunMagasin}
      onChange={(e) => setCordeurRemunMagasin(e.target.checked)}
    />
    Rémunéré en magasin
  </label>
</div>
            <div className="flex items-end">
              <button className="btn-red px-4 py-2 rounded-xl text-white" style={{background:"#E10600"}} onClick={addCordeur}>
                Ajouter
              </button>
            </div>
          </div>
        </div>

        {/* droite : liste */}
        <div>
          <div className="text-sm font-medium mb-2">Liste des cordeurs</div>
          <div className="divide-y">
            {cordeurs.map((c, i)=>(
              <div key={c.cordeur} className="py-2 flex items-center justify-between gap-3">
                {editCordeurIdx===i ? (
                  <input className="input input-bordered text-black bg-white flex-1"
                    defaultValue={c.cordeur}
                    onChange={(e)=>setEditCordeurVal(e.target.value)}
                  />
                ) : (
                  <div className="flex-1 flex items-center gap-3">
  <span className="font-medium truncate">{c.cordeur}</span>

  <label className="inline-flex items-center gap-1 text-xs text-gray-600">
    <input
      type="checkbox"
      checked={!!c.remun_magasin}
      onChange={() => toggleRemunMagasin(c.cordeur, c.remun_magasin)}
    />
    Magasin
  </label>
</div>
                )}
                <div className="shrink-0 flex items-center gap-2">
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
            {cordeurs.length===0 && <div className="py-4 text-sm text-gray-500">Aucun cordeur.</div>}
          </div>
        </div>
      </div>
    </section>

    {/* 3) Statuts : ajouter / modifier */}
    <section className="card p-4">
      <div className="section-bar">Statuts</div>
      <div className="mt-3 grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-600">Ajouter un statut</label>
          <div className="flex gap-2">
            <input className="input input-bordered w-full text-black bg-white"
              placeholder='ex: "A RÉGLER"'
              value={newStatut}
              onChange={(e)=>setNewStatut(e.target.value)}
            />
            <button className="btn-red px-4 rounded-xl text-white" style={{background:"#E10600"}} onClick={addStatut}>Ajouter</button>
          </div>
          <div className="mt-2 text-xs text-gray-500">Table <code>statuts(statut_id)</code>.</div>
        </div>

        <div>
          <label className="text-xs text-gray-600">Modifier un statut</label>
          <div className="space-y-2 mt-1">
            {statuts.map((s, i)=>(
              <div key={s.statut_id} className="flex items-center gap-2">
                {editStatutIdx===i ? (
                  <>
                    <input className="input input-bordered text-black bg-white"
                      defaultValue={s.statut_id}
                      onChange={(e)=>setEditStatutVal(e.target.value)}
                    />
                    <button className="icon-btn" onClick={()=>saveEditStatut(s.statut_id)}>💾</button>
                    <button className="icon-btn" onClick={()=>{setEditStatutIdx(-1); setEditStatutVal("");}}>✖</button>
                  </>
                ) : (
                  <>
                    <span className="text-sm">{s.statut_id}</span>
                    <button className="icon-btn" title="Éditer" onClick={()=>{setEditStatutIdx(i); setEditStatutVal(s.statut_id);}}><IconEdit /></button>
                    <button className="icon-btn-red" title="Supprimer" onClick={()=>deleteStatut(s.statut_id)}><IconTrash /></button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">Si la base a une contrainte FK stricte, le renommage peut être refusé (dans ce cas, ajoute un nouveau statut et migre les lignes plus tard).</div>
        </div>
      </div>
    </section>

    {/* 4) Règles tarifaires */}
    <section className="card p-4">
      <div className="section-bar">Règles tarifaires</div>

      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <div className="text-xs text-gray-600 mb-1">Sans bobine • cordage <b>basique</b></div>
          <input className="input input-bordered w-full text-black bg-white"
            value={T_sansBobine_base}
            onChange={(e)=>setT_sansBobine_base(e.target.value)}
          />
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Sans bobine • cordage <b>spécifique</b></div>
          <input className="input input-bordered w-full text-black bg-white"
            value={T_sansBobine_specific}
            onChange={(e)=>setT_sansBobine_specific(e.target.value)}
          />
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Club avec bobine <b>base</b> • cordage <b>basique</b></div>
          <input className="input input-bordered w-full text-black bg-white"
            value={T_bobineBase_base}
            onChange={(e)=>setT_bobineBase_base(e.target.value)}
          />
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Club avec bobine <b>specific</b> • cordage <b>spécifique</b></div>
          <input className="input input-bordered w-full text-black bg-white"
            value={T_bobineSpec_specific}
            onChange={(e)=>setT_bobineSpec_specific(e.target.value)}
          />
        </div>
      </div>

      <div>
  <div className="text-xs text-gray-600 mb-1">Supplément <b>Express</b> (ajouté au tarif)</div>
  <input className="input input-bordered w-full text-black bg-white"
    value={T_express}
    onChange={(e)=>setT_express(e.target.value)}
  />
  <div className="mt-4 grid sm:grid-cols-2 gap-4">
  <div>
    <div className="text-xs text-gray-600 mb-1">Fourni : tarif <b>12€</b> → gain cordeur</div>
    <input
      className="input input-bordered w-full text-black bg-white"
      value={F_fourni12}
      onChange={(e)=>setF_fourni12(e.target.value)}
    />
  </div>

  <div>
    <div className="text-xs text-gray-600 mb-1">Fourni : tarif <b>14€</b> → gain cordeur</div>
    <input
      className="input input-bordered w-full text-black bg-white"
      value={F_fourni14}
      onChange={(e)=>setF_fourni14(e.target.value)}
    />
  </div>
</div>
</div>

      <div className="mt-3 flex items-center gap-2">
        <button className="btn-red px-4 py-2 rounded-xl text-white" style={{background:"#E10600"}} onClick={saveTarifs}>
          Enregistrer les tarifs
        </button>
        <span className="text-xs text-gray-500">Les montants sont en € TTC ; ils sont écrits en centimes dans <code>tarif_matrix.price_cents</code>.</span>
      </div>

      {/* aperçu de la matrice actuelle */}
      <div className="mt-4 text-sm">
        <div className="font-medium mb-1">Aperçu actuel</div>
        <ul className="list-disc ml-5 space-y-1">
          {tarifsPreview.map((l,i)=>(
            <li key={i}>{l.label} : <b>{euro(Number(l.val||0)/100)}</b></li>
          ))}
        </ul>
      </div>
    </section>

      {/* 5) Moyens de règlement */}
<section className="card p-4">
  <div className="section-bar">Moyens de règlement</div>

  <form onSubmit={addPaymentMode} className="mt-3 grid md:grid-cols-2 lg:grid-cols-4 gap-3">
    <div>
      <label className="text-xs text-gray-600">Code</label>
      <input className="input input-bordered w-full text-black bg-white"
        placeholder="ex: Paypal"
        value={pmCode}
        onChange={(e)=>setPmCode(e.target.value)}
      />
    </div>
    <div>
      <label className="text-xs text-gray-600">Libellé</label>
      <input className="input input-bordered w-full text-black bg-white"
        placeholder="ex: PayPal"
        value={pmLabel}
        onChange={(e)=>setPmLabel(e.target.value)}
      />
    </div>
    <div>
      <label className="text-xs text-gray-600">Emoji (optionnel)</label>
      <input className="input input-bordered w-full text-black bg-white"
        placeholder="ex: 🅿️"
        value={pmEmoji}
        onChange={(e)=>setPmEmoji(e.target.value)}
      />
    </div>
    <div className="flex items-end">
      <button className="btn-red px-4 py-2 rounded-xl text-white" style={{background:"#E10600"}}>
        Ajouter
      </button>
    </div>
  </form>

  <div className="mt-4">
    <div className="text-sm font-medium mb-2">Liste</div>

    {/* Desktop ≥ md : on garde la liste éditable actuelle */}
    <ul className="divide-y hidden md:block">
      {paymentModes.map((pm, i)=>(
        <li key={pm.code} className="py-2 flex items-center gap-3">
        {/* emoji affiché */}
        <span className="w-6 text-center">{pm.emoji || "—"}</span>
      
        {/* Label éditable + code en petit en dessous (plus de doublon de colonne) */}
        <div className="min-w-0 flex-1">
          <input
            className="input input-bordered text-black bg-white w-full"
            value={pm.label}
            onChange={(e)=>updatePaymentMode(pm, { label: e.target.value })}
          />
        </div>
      
        {/* Emoji éditable */}
        <input
          className="input input-bordered text-black bg-white w-20"
          value={pm.emoji || ""}
          onChange={(e)=>updatePaymentMode(pm, { emoji: e.target.value || null })}
          title="Emoji"
        />
      
        {/* État (activé / caché) */}
        <button
          type="button"
          onClick={()=>togglePaymentMode(pm)}
          className={`px-2 py-1 rounded border ${pm.enabled ? "bg-green-50 border-green-300" : "bg-gray-50"}`}
        >
          {pm.enabled ? "Activé" : "Caché"}
        </button>
      
        {/* Réordonner + supprimer */}
        <div className="ml-auto flex items-center gap-1">
          <button className="px-2 py-1 rounded border" disabled={i===0}
                  onClick={()=>movePaymentMode(pm,-1)}>↑</button>
          <button className="px-2 py-1 rounded border" disabled={i===paymentModes.length-1}
                  onClick={()=>movePaymentMode(pm,1)}>↓</button>
          <button className="px-2 py-1 rounded border text-red-600"
                  onClick={()=>deletePaymentMode(pm.code)}>Suppr</button>
        </div>
      </li>      
      ))}
      {paymentModes.length===0 && <li className="py-3 text-sm text-gray-500">Aucun moyen.</li>}
    </ul>

    {/* Mobile < md : carte compacte sans lignes en double */}
    <div className="space-y-3 md:hidden">
      {paymentModes.map((pm, i)=>(
        <div key={pm.code} className="rounded-2xl border p-3 bg-white">
          <div className="flex items-center gap-3">
            <span className="text-xl w-7 text-center">{pm.emoji || "—"}</span>
            <div className="font-semibold truncate">{pm.label || pm.code}</div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={()=>togglePaymentMode(pm)}
                className={`px-2 py-1 rounded border text-xs ${pm.enabled ? "bg-green-50 border-green-300" : "bg-gray-50"}`}
              >
                {pm.enabled ? "Activé" : "Caché"}
              </button>
              <button className="px-2 py-1 rounded border" disabled={i===0} onClick={()=>movePaymentMode(pm,-1)}>↑</button>
              <button className="px-2 py-1 rounded border" disabled={i===paymentModes.length-1} onClick={()=>movePaymentMode(pm,1)}>↓</button>
              <button className="px-2 py-1 rounded border text-red-600" onClick={()=>deletePaymentMode(pm.code)}>Suppr</button>
            </div>
          </div>
        </div>
      ))}
      {paymentModes.length===0 && <div className="py-3 text-sm text-gray-500">Aucun moyen.</div>}
    </div>
  </div>
</section>
</div>
<Toast
  open={toastOpen}
  onClose={() => setToastOpen(false)}
  title={toastTitle}
  message={toastMessage}
  variant={toastVariant}
/>

<ConfirmModal
  open={confirmOpen}
  title={confirmConfig.title}
  message={confirmConfig.message}
  icon={confirmConfig.icon}
  confirmLabel={confirmConfig.confirmLabel}
  cancelLabel={confirmConfig.cancelLabel}
  danger={confirmConfig.danger}
  onCancel={() => {
    setConfirmOpen(false);
    setConfirmAction(null);
  }}
  onConfirm={async () => {
    setConfirmOpen(false);
    const fn = confirmAction;
    setConfirmAction(null);
    await fn?.();
  }}
/>
  </PasscodeGate>
);
}