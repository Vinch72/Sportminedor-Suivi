// src/components/SuiviForm.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { toCanonical, normalize } from "../utils/payment";

/**
 * Props optionnelles pour l'édition :
 * - editingId: number | null
 * - initialData: objet "suivi" avec les colonnes du formulaire (si editingId)
 * - onDone: callback appelé après succès (insert/update)
 */

const U = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();

// 👇 Ajoute ces fonctions juste en dessous
function formatPhone(raw) {
  // Supprime tout sauf chiffres et "+"
  let digits = raw.replace(/[^\d+]/g, "");
  // Convertit "06..." ou "06..." → "+336..."
  if (digits.startsWith("0") && digits.length >= 1) {
    digits = "+33" + digits.slice(1);
  }
  // Si pas de "+", on préfixe
  if (!digits.startsWith("+")) {
    digits = "+33" + digits;
  }
  return digits;
}

function formatNom(s) {
  return (s || "").toUpperCase();
}

function formatPrenom(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/(^|\s|-)([a-zàâäéèêëîïôùûüç])/g, (_, sep, letter) => sep + letter.toUpperCase());
}

export default function SuiviForm({ editingId, initialData, onDone, onTitleChange }) {  
  const isEdit = !!editingId; // [EDIT]

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // listes
  const [clients, setClients] = useState([]);
  async function reloadClients() {
    const { data, error } = await supabase
      .from("clients")
      .select("id, nom, prenom, club, tension, cordage, phone")
      .order("nom");
    if (!error) setClients(data || []);
    return !error;
  }
  const [statuts, setStatuts] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [cordages, setCordages] = useState([]);
  const [tournois, setTournois] = useState([]);
  const [cordeurs, setCordeurs] = useState([]);
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [express, setExpress] = useState(false);
  const [expressCents, setExpressCents] = useState(400);

  // formulaire
  const [savePrefs, setSavePrefs] = useState(false);
  const [qte, setQte] = useState(1);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statutId, setStatutId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clubId, setClubId] = useState("");
  const [lieu, setLieu] = useState(""); // => suivi.lieu_id
  const [cordageId, setCordageId] = useState("");
  const [cordeurId, setCordeurId] = useState(""); // => suivi.cordeur_id
  const [couleur, setCouleur] = useState("");
  const [tension, setTension] = useState("");
  const [raquette, setRaquette] = useState("");
  const [fourni, setFourni] = useState(false);
  const [offert, setOffert] = useState(false);
  const [askPay, setAskPay] = useState(null); // { ids: number[] } ou null

  // 🔹 Lieu par défaut = "Magasin"
useEffect(() => {
  if (lieu) return;                 // ne pas écraser un choix existant
  if (!tournois || !tournois.length) return;

  const mag = tournois.find(t => U(t.tournoi) === "MAGASIN");
  if (mag) setLieu(mag.tournoi);
}, [tournois, lieu]);

  // Informe le parent pour afficher "🏸 {raquette}" dans le titre
useEffect(() => {
  if (typeof onTitleChange === "function") {
    onTitleChange(raquette || "");
  }
}, [raquette, onTitleChange]);

  function applyClientPrefs(c, { overwrite = false } = {}) {
    if (!c) return;
    if (overwrite || (!clubId && c.club)) setClubId(c.club || "");
    if (overwrite || (!tension && c.tension)) setTension(c.tension || "");
    if (overwrite || (!cordageId && c.cordage)) setCordageId(c.cordage || "");
  }  

  // [EDIT] Pré-initialisation si mode édition
  useEffect(() => {
    if (isEdit && initialData) {
      setDate(initialData.date?.slice(0,10) ?? new Date().toISOString().slice(0,10));
      setStatutId(initialData.statut_id ?? "");
      setClientId(initialData.client_id ?? "");
      setClubId(initialData.club_id ?? "");
      setLieu(initialData.lieu_id ?? "");
      setCordageId(initialData.cordage_id ?? "");
      setCordeurId(initialData.cordeur_id ?? "");
      setCouleur(initialData.couleur ?? "");
      setTension(initialData.tension ?? "");
      setRaquette(initialData.raquette ?? "");
      setNote(initialData.note ?? "");
      setFourni(!!initialData.fourni);
      setOffert(!!initialData.offert);
      setPhone(initialData.client_phone ?? "");
      setExpress(!!initialData.express);
    }
  }, [isEdit, initialData]);

  // charge les listes (RLS SELECT requis sur chaque table)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(""); setOk("");
      try {
        const [cl, st, cb, co, tn, cr] = await Promise.all([
          supabase.from("clients").select("id, nom, prenom, club, tension, cordage, phone").order("nom"),
          supabase.from("statuts").select("statut_id").order("statut_id"),
          supabase.from("clubs").select("clubs, bobine_base, bobine_specific").order("clubs"),
          supabase.from("cordages").select("cordage, is_base").order("cordage"),
          supabase.from("tournois").select("tournoi"),
          supabase.from("cordeur").select("cordeur").order("cordeur"),
        ]);
        const maybeErr = [cl, st, cb, co, tn, cr].find(r => r.error)?.error;
        if (maybeErr) throw maybeErr;

        setClients(cl.data || []);
        setStatuts(st.data || []);
        setClubs(cb.data || []);
        setCordages(co.data || []);
        const lieux = (tn.data || []).slice().sort((a, b) => {
  const A = (a.tournoi || "").toString();
  const B = (b.tournoi || "").toString();

  if (U(A) === "MAGASIN" && U(B) !== "MAGASIN") return -1;
  if (U(B) === "MAGASIN" && U(A) !== "MAGASIN") return 1;

  return A.localeCompare(B, "fr", { sensitivity: "base" });
});

        setTournois(lieux);
        setCordeurs(cr.data || []);

       // Valeur par défaut du statut (si pas d'initialData) = "A FAIRE" (insensible aux accents/majuscules)
        if (!isEdit && !statutId && (st.data || []).length) {
          const wanted = (st.data || []).find(s => U(s.statut_id) === "A FAIRE");
          const fallback = st.data[0]?.statut_id || "";
          setStatutId(wanted?.statut_id || fallback);
        }
      } catch (e) {
        setErr(e.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line

  // 🔄 Quand la page Clients ajoute/édite/supprime, on recharge la liste ici
useEffect(() => {
    const onClients = () => { reloadClients(); };
    window.addEventListener("clients:updated", onClients);
    return () => window.removeEventListener("clients:updated", onClients);
  }, []);

  // Auto-remplir club/tension/cordage quand le client change (sans écraser ce qui existe déjà)
const [lastClientId, setLastClientId] = useState(null);

useEffect(() => {
  const c = clients.find(x => x.id === clientId);
  if (!c) return;

  // Ne fait l'auto-fill que si on vient de changer de client
  if (clientId !== lastClientId) {
    if (!clubId && c.club) setClubId(c.club);
    if (!tension && c.tension) setTension(c.tension);
    if (!cordageId && c.cordage) setCordageId(c.cordage);
    if (!phone && c.phone) setPhone(formatPhone(c.phone));

    setLastClientId(clientId);
  }
}, [clientId, clients, lastClientId, clubId, tension, cordageId, phone]);

  // helpers labels + calcul tarif
  const clientsMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);
  const cordageObj = useMemo(() => cordages.find(c => c.cordage === cordageId) || null, [cordages, cordageId]);
  const clubObj    = useMemo(() => clubs.find(c => c.clubs === clubId) || null, [clubs, clubId]);

  useEffect(() => {
  (async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value_cents")
      .eq("key", "express_surcharge_cents")
      .maybeSingle();

    if (!error && data?.value_cents != null) {
      setExpressCents(Number(data.value_cents));
    }
  })();
}, []);

  function calcTarif() {
  let base = null;

  if (offert) base = 0;
  else if (fourni) base = 12;
  else {
    if (!clubObj || !cordageObj) return null;
    const isBase = !!cordageObj.is_base;
    const hasBase = !!clubObj.bobine_base;
    const hasSpec = !!clubObj.bobine_specific;
    if (!hasBase && !hasSpec) base = isBase ? 18 : 20;
    else if (hasBase && !hasSpec) base = isBase ? 12 : 20;
    else if (hasBase && hasSpec) {
    // ✅ Exception FABREGUES : bobine spécifique = 12€ (au lieu de 14)
    const isFabregues =
      String(clubObj?.clubs || clubId || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toUpperCase() === "FABREGUES";

    if (isFabregues && !isBase) base = 12;
    else base = isBase ? 12 : 14;
  }
}

  // ✅ EXPRESS +4€
if (base != null && express) base += (expressCents / 100);
  return base;
}

  const tarif = useMemo(() => calcTarif(), [
  offert, fourni, express,
  clubObj, cordageObj
]);

function computeBobineUsed({ fourni, clubId, cordageId, clubs, cordages }) {
  if (fourni) return "none";

  const club = (clubs || []).find(c => c.clubs === clubId);
  const cord = (cordages || []).find(x => x.cordage === cordageId);

  // si on ne sait pas déterminer, on ne compte pas
  if (!club || !cord) return "none";

  const isBase = !!cord.is_base;

  if (isBase && club.bobine_base) return "base";
  if (!isBase && club.bobine_specific) return "specific";
  return "none";
}

  // INSERT **ou** UPDATE selon mode
  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErr(""); setOk("");
    try {
      if (!clientId || !statutId || !date || !clubId || !cordageId) {
        throw new Error("Merci de remplir : client, statut, date, club, cordage.");
      }

      // ✅ Vérifie que le client sélectionné existe encore (évite l’erreur FK si la liste n’était pas à jour)
const clientsSet = new Set((clients || []).map(c => c.id));
if (!clientsSet.has(clientId)) {
  await reloadClients();
  const clientsSet2 = new Set((clients || []).map(c => c.id));
  if (!clientsSet2.has(clientId)) {
    alert("Le client sélectionné n'existe plus. Merci de le re-sélectionner.");
    return; // on stoppe l’insert proprement
  }
}
const cli = clients.find(x => x.id === clientId);
const clientName = `${cli?.nom || ""} ${cli?.prenom || ""}`.trim() || null;
const finalTarif = calcTarif();
      const base = {
        date,
        statut_id: statutId,
        client_id: clientId,
        client_name: clientName,
        client_phone: (phone || null),
        club_id: clubId,
        lieu_id: lieu || null,
        cordage_id: cordageId,
        cordeur_id: cordeurId || null,
        couleur: (couleur?.trim() ? couleur.trim() : "none"),
        tension: (tension || null),
        raquette: (raquette || null),
        note: (note || null),
        fourni,
        offert,
        express,
        tarif: finalTarif ?? null,
        bobine_used: computeBobineUsed({ fourni, clubId, cordageId, clubs, cordages }),
      };

      if (isEdit) {
  const { data, error } = await supabase
    .from("suivi")
    .update(base)
    .eq("id", editingId)
    .select("id");

  if (error) throw error;
  if (!data || data.length !== 1) {
    throw new Error("Mise à jour incomplète. Vérifie RLS/colonnes.");
  }

  // ✅ Force le tarif en base aussi en EDIT (comme à l'insert)
  const forcedTarif = offert ? 0 : (finalTarif ?? null);
  await supabase
    .from("suivi")
    .update({ tarif: forcedTarif, express: !!express })
    .eq("id", editingId);

      // --- Sauvegarde des préférences client si demandé (EDIT) ---
      try {
        if (savePrefs && clientId) {
          await supabase
            .from("clients")
            .update({
              tension:  tension  || null,
              cordage:  cordageId || null,   // clients.cordage = string (ex: "BG65")
            })
            .eq("id", clientId);

          window.dispatchEvent(new CustomEvent("clients:updated", { detail: { id: clientId }}));
        }
      } catch (e) {
        console.warn("Maj préférences client (edit) ignorée:", e);
      }
        setOk("✅ Ligne mise à jour.");
        window.dispatchEvent(new CustomEvent("suivi:updated", { detail: { id: editingId }}));
        onDone?.({ type: "updated", id: editingId });
        return;
      }

      // INSERT (comportement actuel)
      const qty = Math.max(1, Number(qte) || 1);
      const payload = Array.from({ length: qty }, () => ({ ...base }));

      const { data, error } = await supabase
        .from("suivi")
        .insert(payload)
        .select("id");

        const ids = (data || []).map(d => d.id).filter(Boolean);

// 🔒 Force le tarif en base (utile si un trigger/logic l'écrase à l'insert)
if (ids.length) {
  const forcedTarif = offert ? 0 : (finalTarif ?? null);
  await supabase
    .from("suivi")
    .update({ tarif: forcedTarif })
    .in("id", ids);
}

      if (error) {
        console.error("❌ Insert error:", error);
        throw error;
      }

      // --- Sauvegarde des préférences client si demandé (CREATE) ---
try {
  if (savePrefs && clientId) {
    const { data, error } = await supabase
      .from("clients")
      .update({
        tension: tension || null,
        cordage: cordageId || null,
        // Bonus utile : si tu veux aussi sauvegarder le club choisi
        club: clubId || null,
        // Bonus utile : sauvegarder le tel si tu le renseignes
        phone: phone || null,
      })
      .eq("id", clientId)
      .select("id");

    if (error) throw error;
    if (!data || data.length !== 1) throw new Error("Client non mis à jour (RLS/ID).");

    window.dispatchEvent(new CustomEvent("clients:updated", { detail: { id: clientId } }));
  }
} catch (e) {
  console.error("❌ Maj préférences client (create) KO:", e);
  setErr(`❌ Impossible de mettre à jour la fiche client : ${e.message || e}`);
}


// ✅ Si "offert" est coché, on marque directement comme "Offert" (billet vert)
      try {
        const ids = (data || []).map(d => d.id).filter(Boolean);
        if (offert && ids.length) {
          await supabase
            .from("suivi")
            .update({
              reglement_mode: "Offert",
              reglement_date: new Date().toISOString(),
              tarif: 0, // sécurité même si déjà 0
            })
            .in("id", ids);
        } else if (U(statutId) === "PAYE" && ids.length) {
          // sinon, si statut = PAYÉ, on affiche la modale pour choisir le mode
          setAskPay({ ids });
        }
      } catch (e) {
        console.warn("Maj 'Offert' après création:", e);
      }

      if (!data || data.length !== payload.length) {
        throw new Error(`Insertion incomplète (${data?.length ?? 0}/${payload.length}). Vérifie RLS/colonnes.`);
      }

      setOk(`✅ ${data.length} ligne(s) ajoutée(s).`);
setQte(1);
setCouleur(""); setTension(""); setRaquette(""); setNote(""); setPhone(""); setExpress(false);

// Si PAYÉ -> on ouvre d'abord la modale de paiement, et
// on NE ferme PAS la popup principale avant d'avoir choisi le mode.
try {
  const ids = (data || []).map(d => d.id).filter(Boolean);
  if (U(statutId) === "PAYE" && ids.length) {
    setAskPay({
      ids,
      after: () => {
        // ce callback sera appelé après la mise à jour du règlement
        window.dispatchEvent(new CustomEvent("suivi:created"));
        onDone?.({ type: "created", count: data.length });
      }
    });
    return; // <- très important : on laisse la modale ouverte !
  }
} catch (e) {
  console.warn("ask payment after creation:", e);
}

// Sinon (pas PAYÉ), on termine normalement
window.dispatchEvent(new CustomEvent("suivi:created"));
onDone?.({ type: "created", count: data.length });

    } catch (e) {
      setErr(e.message || "Erreur à l’enregistrement");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="bg-white rounded-xl shadow-card p-6">Chargement…</div>;

  return (
<div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
      {isEdit && (
  <h3 className="font-semibold mb-4">Modifier une ligne</h3>
)}

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Quantité + Date + Statut */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {!isEdit && (
    <Field label="Nombre de raquettes">
      <input type="number" min={1} value={qte} onChange={e=>setQte(e.target.value)} className="w-full border rounded-lg p-2" />
    </Field>
  )}
  <Field label="Date">
    <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full border rounded-lg p-2" />
  </Field>
  <Field label="Statut">
    <select value={statutId} onChange={e=>setStatutId(e.target.value)} className="w-full border rounded-lg p-2">
      {statuts.map(s=> <option key={s.statut_id} value={s.statut_id}>{s.statut_id}</option>)}
    </select>
  </Field>
</div>

        {/* Client + Club + Lieu */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Field label="Client">
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <SearchSelect
          items={clients}
          value={clientId}
          onChange={setClientId}
          getValue={c => c.id}
          getLabel={c => [formatPrenom(c.prenom), formatNom(c.nom)].filter(Boolean).join(" ") || c.id}
          placeholder="Rechercher un client…"
        />
      </div>
      <button
        type="button"
        className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        title="Appliquer les préférences du client (club/tension/cordage)"
        onClick={() => {
          const c = clients.find(x => x.id === clientId);
          applyClientPrefs(c, { overwrite: true });
        }}
        disabled={!clientId}
      >
        Appliquer
      </button>
    </div>
  </Field>

  <Field label="Téléphone (auto)">
    <input
      type="text"
      value={phone}
      onChange={(e) => setPhone(formatPhone(e.target.value))}
      className="w-full border rounded-lg p-2"
      placeholder="ex: +33 6 12 34 56 78"
    />
  </Field>

  <Field label="Club">
    <SearchSelect
      items={clubs}
      value={clubId}
      onChange={setClubId}
      getValue={c => c.clubs}
      getLabel={c => c.clubs}
      placeholder="Rechercher un club…"
    />
  </Field>

  <Field label="Lieu de cordage (optionnel)">
    <SearchSelect
      items={tournois}
      value={lieu}
      onChange={setLieu}
      getValue={t => t.tournoi}
      getLabel={t => t.tournoi}
      placeholder="Rechercher un lieu…"
      allowEmpty
    />
  </Field>

        {/* Cordage + Couleur + Tension */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Field label="Cordage">
    <SearchSelect
      items={cordages}
      value={cordageId}
      onChange={setCordageId}
      getValue={c => c.cordage}
      getLabel={c => c.cordage}
      placeholder="Rechercher un cordage…"
    />
  </Field>

  <Field label="Tension">
    <input type="text" value={tension} onChange={e=>setTension(e.target.value)} className="w-full border rounded-lg p-2" placeholder="ex: 11-11,5" />
  </Field>

  <Field label="Couleur">
    <input type="text" value={couleur} onChange={e=>setCouleur(e.target.value)} className="w-full border rounded-lg p-2" placeholder="ex: noir, rouge…" />
  </Field>

  <label className="flex items-center gap-2 text-sm mt-6">
    <input type="checkbox" checked={savePrefs} onChange={(e)=>setSavePrefs(e.target.checked)} />
    <span>Enregistrer pour les futurs cordages (met à jour la fiche client)</span>
  </label>
</div>

        {/* Raquette + Cordeur + Oui/Non */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Field label="Modèle de raquette">
    <input type="text" value={raquette} onChange={e=>setRaquette(e.target.value.toUpperCase())} className="w-full border rounded-lg p-2" placeholder="ex: Astrox 88 S Pro" />
  </Field>

  <Field label="Cordeur">
    <select value={cordeurId} onChange={e=>setCordeurId(e.target.value)} className="w-full border rounded-lg p-2">
      <option value="">— choisir —</option>
      {cordeurs.map(c=> <option key={c.cordeur} value={c.cordeur}>{c.cordeur}</option>)}
    </select>
  </Field>

  <Field label="Cordage fourni">
    <Toggle checked={fourni} onChange={setFourni} />
  </Field>

  <Field label="Prestation offerte">
    <Toggle checked={offert} onChange={setOffert} />
  </Field>

 <Field label="Express (+X€)">
    <Toggle checked={express} onChange={setExpress} />
  </Field>

</div>

        {/* Note */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Field label="Note (optionnel)">
    <textarea
      className="w-full border rounded-lg p-2"
      rows={2}
      placeholder="Ex: rendre la raquette sur le tournoi de Pérols"
      value={note}
      onChange={(e) => setNote(e.target.value)}
    />
  </Field>

  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border">
    <div className="text-gray-600">Tarif calculé</div>
    <div className="text-xl font-semibold">
      {tarif == null ? "—" : `${tarif} €`}
    </div>
  </div>
</div>

        {err && <p className="text-red-600">{err}</p>}
        {ok && <p className="text-green-700">{ok}</p>}
</div>
        <div className="pt-3 mt-4 flex items-center justify-end gap-2 border-t bg-white">
          {isEdit && (
            <button
              type="button"
              onClick={() => onDone?.({ type: "cancel" })}
              className="px-4 py-2 rounded-lg border border-gray-300"
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-brand-red text-white disabled:opacity-50"
          >
            {saving ? (isEdit ? "Mise à jour…" : "Enregistrement…") : (isEdit ? "Modifier" : "Ajouter")}
          </button>
        </div>
      </form>
      {/* Modale "Choisir le mode de règlement" */}
      {askPay && (
  <PaymentModeModal
    onClose={() => {
      // si l’utilisateur ferme sans choisir, on termine quand même
      const after = askPay.after;
      setAskPay(null);
      after?.();
    }}
    onPick={async (modeCanon) => {
      try {
        await supabase
          .from("suivi")
          .update({
            reglement_mode: modeCanon,
            reglement_date: new Date().toISOString(),
          })
          .in("id", askPay.ids);

        // on passe le statut à PAYÉ côté listes live si besoin
        window.dispatchEvent(new CustomEvent("suivi:updated"));
      } catch (e) {
        alert("Mise à jour du règlement refusée");
      } finally {
        const after = askPay.after;
        setAskPay(null);
        after?.(); // -> ferme la popup parente et rafraîchit
      }
    }}
  />
)}
    </div>
  );
}

/* ===== UI bits ===== */
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-600">{label}</span>
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

/* ===== Select avec recherche (client, club, lieu, cordage) ===== */
function SearchSelect({
  items,
  value,
  onChange,
  getLabel,
  getValue,
  placeholder = "Rechercher…",
  allowEmpty = false,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const norm = (s) =>
    (s || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  useEffect(() => {
    const item = items.find((it) => getValue(it) === value);
    setQuery(item ? getLabel(item) : "");
  }, [value, items]);

  const filtered = useMemo(() => {
    const nq = norm(query);
    if (!nq) return items.slice(0, 50);
    return items.filter((it) => norm(getLabel(it)).includes(nq)).slice(0, 50);
  }, [items, query]);

  function pick(val) {
    onChange(val);
    const item = items.find((it) => getValue(it) === val);
    setQuery(item ? getLabel(item) : "");
    setOpen(false);
  }
  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = filtered[0];
      if (first) pick(getValue(first));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        className="w-full border rounded-lg p-2"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {allowEmpty && !value && !query && (
        <div className="absolute -bottom-5 text-xs text-gray-400">Optionnel</div>
      )}
      {open && (
        <div
          className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow max-h-60 overflow-auto"
          onMouseLeave={() => setOpen(false)}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">Aucun résultat</div>
          ) : (
            filtered.map((it) => {
              const val = getValue(it);
              const label = getLabel(it);
              return (
                <button
                  type="button"
                  key={val}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onMouseDown={(e) => { e.preventDefault(); pick(val); }}
                >
                  {label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function PaymentModeModal({ onClose, onPick }) {
  const options = [
    { key: "CB", label: "CB", emoji: "💳" },
    { key: "Especes", label: "Espèces", emoji: "💶" },
    { key: "Cheque", label: "Chèque", emoji: "🧾" },
    { key: "Virement", label: "Virement", emoji: "🏦" },
    { key: "Offert", label: "Offert", emoji: "🎁" },
  ];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none">💶</div>
          <div className="flex-1">
            <div className="text-lg font-semibold">Mode de règlement</div>
            <div className="text-sm text-gray-600">
              Choisis le mode utilisé pour cette raquette.
            </div>
          </div>
          <button
            aria-label="Fermer"
            className="text-gray-500 hover:text-black"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onPick(opt.key)}
              className="flex items-center justify-center gap-2 h-11 rounded-xl border bg-white hover:bg-gray-50 hover:shadow transition"
            >
              <span className="text-lg">{opt.emoji}</span>
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 h-10 rounded-xl border text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
