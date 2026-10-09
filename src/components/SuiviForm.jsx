// src/components/SuiviForm.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { toCanonical, normalize } from "../utils/payment";
import { raquetteLabel, fetchClientRaquettes, resolveRaquette, saveRaquettePrefs as saveRaqPrefs } from "../utils/raquettes";
import RaquetteChips from "./RaquetteChips";
import { fetchAll } from "../utils/fetchAll";

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
    const { data, error } = await fetchAll(() => supabase
      .from("clients")
      .select("id, nom, prenom, club, tension, cordage, phone")
      .order("nom").order("id"));
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
  const [raquetteId, setRaquetteId] = useState(""); // => suivi.raquette_id (facultatif)
  const [clientRaquettes, setClientRaquettes] = useState([]);
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
      setRaquetteId(initialData.raquette_id ?? "");
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
          fetchAll(() => supabase.from("clients").select("id, nom, prenom, club, tension, cordage, phone").order("nom").order("id")),
          supabase.from("statuts").select("statut_id").order("statut_id"),
          supabase.from("clubs").select("clubs, bobine_base, bobine_specific").order("clubs"),
          supabase.from("cordages").select("cordage, is_base, marque").order("marque", { nullsFirst: false }).order("cordage"),
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

  // Raquettes enregistrées du client (table raquettes ; silencieux si indisponible)
  useEffect(() => {
    if (!clientId) { setClientRaquettes([]); return; }
    let alive = true;
    fetchClientRaquettes(clientId).then(list => {
        if (!alive) return;
        setClientRaquettes(list);
        // Changement de client : la raquette liée n'est plus la sienne
        setRaquetteId(id => (id && !list.some(r => r.id === id) ? "" : id));
      });
    return () => { alive = false; };
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickRaquette(r) {
    setRaquetteId(r.id);
    setRaquette(raquetteLabel(r));
    // En création : cordage/tension mémorisés sur la raquette
    if (!isEdit) {
      if (r.pref_cordage_id) setCordageId(r.pref_cordage_id);
      if (r.pref_tension) setTension(r.pref_tension);
    }
  }

  function onRaquetteTextChange(v) {
    const txt = v.toUpperCase();
    setRaquette(txt);
    const linked = clientRaquettes.find(r => r.id === raquetteId);
    if (raquetteId && (!linked || raquetteLabel(linked) !== txt)) setRaquetteId("");
  }

  // Raquette à lier au suivi (sélectionnée / même libellé / créée). Jamais bloquant.
  async function resolveRaquetteId() {
    const { id, created } = await resolveRaquette({
      clientId, text: raquette, selectedId: raquetteId, list: clientRaquettes, cordageId, tension,
    });
    if (created) setClientRaquettes(prev => [created, ...prev]);
    return id;
  }

  // "Enregistrer pour les futurs cordages" : mémorise aussi sur la raquette
  const saveRaquettePrefs = (id) => saveRaqPrefs(id, { cordageId, tension });

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

      // Lien facultatif vers la table raquettes (le texte "raquette" reste rempli)
      const linkedRaquetteId = await resolveRaquetteId();
      if (linkedRaquetteId || initialData?.raquette_id) base.raquette_id = linkedRaquetteId;

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
          await saveRaquettePrefs(base.raquette_id);

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
    await saveRaquettePrefs(base.raquette_id);

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
setCouleur(""); setTension(""); setRaquette(""); setRaquetteId(""); setNote(""); setPhone(""); setExpress(false);

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

  const inputCls = "w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {isEdit && (
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3" style={{ background: "rgba(225,6,0,0.04)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "rgba(225,6,0,0.10)" }}>✏️</div>
          <div className="font-semibold text-gray-900 text-sm">Modifier une ligne</div>
        </div>
      )}

      <form onSubmit={onSubmit} className="divide-y divide-gray-100">

        {/* ── Général ── */}
        <div className="px-5 py-4 space-y-3">
          <SectionTitle>Général</SectionTitle>
          <div className={`grid gap-3 grid-cols-1 ${isEdit ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
            {!isEdit && (
              <Field label="Nb raquettes">
                <input type="number" min={1} value={qte} onChange={e=>setQte(e.target.value)} className={inputCls} />
              </Field>
            )}
            <Field label="Date">
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Statut">
              <select value={statutId} onChange={e=>setStatutId(e.target.value)} className={inputCls}>
                {statuts.map(s=> <option key={s.statut_id} value={s.statut_id}>{s.statut_id}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* ── Client ── */}
        <div className="px-5 py-4 space-y-3">
          <SectionTitle>Client</SectionTitle>
          <Field label="Client *">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
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
                className="h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 shrink-0"
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
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <Field label="Téléphone">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className={inputCls}
                placeholder="+33 6 12 34 56 78"
              />
            </Field>
            <Field label="Club *">
              <SearchSelect
                items={clubs}
                value={clubId}
                onChange={setClubId}
                getValue={c => c.clubs}
                getLabel={c => c.clubs}
                placeholder="Rechercher un club…"
              />
            </Field>
          </div>
        </div>

        {/* ── Raquette & Cordage ── */}
        <div className="px-5 py-4 space-y-3">
          <SectionTitle>Raquette & Cordage</SectionTitle>
          <Field label="Raquette">
            <input type="text" value={raquette} onChange={e=>onRaquetteTextChange(e.target.value)} className={inputCls} placeholder="ex: ASTROX 88 S PRO" />
            <RaquetteChips raquettes={clientRaquettes} selectedId={raquetteId} onPick={pickRaquette} />
          </Field>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <Field label="Cordage *">
              <SearchSelect
                items={cordages}
                value={cordageId}
                onChange={setCordageId}
                getValue={c => c.cordage}
                getLabel={c => c.cordage}
                getGroup={c => c.marque || "Autres"}
                placeholder="Rechercher un cordage…"
              />
            </Field>
            <Field label="Tension">
              <input type="text" value={tension} onChange={e=>setTension(e.target.value)} className={inputCls} placeholder="ex: 11-11,5" />
            </Field>
            <Field label="Couleur">
              <input type="text" value={couleur} onChange={e=>setCouleur(e.target.value)} className={inputCls} placeholder="ex: noir, rouge…" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-600">
            <input type="checkbox" checked={savePrefs} onChange={(e)=>setSavePrefs(e.target.checked)} className="accent-[#E10600]" />
            <span>Mémoriser cordage & tension pour les prochaines fois (fiche client et raquette)</span>
          </label>
        </div>

        {/* ── Options ── */}
        <div className="px-5 py-4 space-y-3">
          <SectionTitle>Options</SectionTitle>
          <div className="grid gap-2 grid-cols-3">
            <ToggleChip active={fourni}  onClick={() => setFourni(v => !v)}  label={fourni  ? "Fourni ✓"  : "Cordage fourni"} />
            <ToggleChip active={offert}  onClick={() => setOffert(v => !v)}  label={offert  ? "Offert ✓"  : "Offert"} />
            <ToggleChip active={express} onClick={() => setExpress(v => !v)} label={express ? "Express ✓" : `Express +${(expressCents / 100).toLocaleString("fr-FR")} €`} />
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <Field label="Cordeur">
              <select value={cordeurId} onChange={e=>setCordeurId(e.target.value)} className={inputCls}>
                <option value="">— choisir —</option>
                {cordeurs.map(c=> <option key={c.cordeur} value={c.cordeur}>{c.cordeur}</option>)}
              </select>
            </Field>
            <Field label="Lieu de cordage (optionnel)">
              <SearchSelect
                items={tournois}
                value={lieu}
                onChange={setLieu}
                getValue={t => t.tournoi}
                getLabel={t => t.tournoi}
                placeholder="Magasin, tournoi…"
                allowEmpty
              />
            </Field>
          </div>
        </div>

        {/* ── Notes & Tarif ── */}
        <div className="px-5 py-4 space-y-3">
          <SectionTitle>Notes & Tarif</SectionTitle>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition resize-none"
            rows={2}
            placeholder="Ex: rendre la raquette sur le tournoi de Pérols"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="rounded-xl px-4 h-12 border flex items-center justify-between"
            style={{ background: "rgba(225,6,0,0.04)", borderColor: "rgba(225,6,0,0.2)" }}>
            <span className="text-sm text-gray-500">Tarif calculé</span>
            <span className={`text-xl font-bold ${tarif == null ? "text-gray-300" : ""}`} style={tarif != null ? { color: "#E10600" } : {}}>
              {tarif == null ? "—" : `${tarif} €`}
            </span>
          </div>
        </div>

        {/* ── Pied ── */}
        <div className="px-5 py-4 bg-gray-50 space-y-3">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{err}</p>}
          {ok && <p className="text-green-700 text-sm bg-green-50 rounded-xl px-3 py-2">{ok}</p>}
          <div className="flex items-center justify-end gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={() => onDone?.({ type: "cancel" })}
                className="h-10 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-6 rounded-xl text-sm font-semibold text-white bg-brand-red disabled:opacity-50 transition shadow-sm"
            >
              {saving ? (isEdit ? "Mise à jour…" : "Enregistrement…") : (isEdit ? "Modifier" : "Ajouter")}
            </button>
          </div>
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
function SectionTitle({ children }) {
  return <div className="inline-block text-xs font-bold text-gray-700 uppercase tracking-wide bg-gray-100 rounded-lg px-2.5 py-1">{children}</div>;
}
function ToggleChip({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick}
      className="h-10 rounded-xl border text-sm font-medium transition px-2"
      style={active
        ? { background: "#E10600", color: "#fff", borderColor: "#E10600" }
        : { background: "#fff", color: "#374151", borderColor: "#e5e7eb" }}>
      {label}
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
  getGroup,
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
        className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition"
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
          className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto text-sm"
          onMouseLeave={() => setOpen(false)}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">Aucun résultat</div>
          ) : query.trim() ? (
            filtered.map((it) => (
              <button type="button" key={getValue(it)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50"
                onMouseDown={(e) => { e.preventDefault(); pick(getValue(it)); }}>
                {getLabel(it)}
              </button>
            ))
          ) : (() => {
            const resolveGroup = (it) => getGroup ? getGroup(it) : (it.group || null);
            const hasGroups = filtered.some(it => resolveGroup(it));
            if (!hasGroups) return filtered.map((it) => (
              <button type="button" key={getValue(it)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50"
                onMouseDown={(e) => { e.preventDefault(); pick(getValue(it)); }}>
                {getLabel(it)}
              </button>
            ));
            const groups = {};
            const order = [];
            filtered.forEach(it => {
              const g = resolveGroup(it) || "Autres";
              if (!groups[g]) { groups[g] = []; order.push(g); }
              groups[g].push(it);
            });
            return order.map(g => (
              <div key={g}>
                <div className="px-3 pt-2 pb-0.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{g}</div>
                {groups[g].map(it => (
                  <button type="button" key={getValue(it)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    onMouseDown={(e) => { e.preventDefault(); pick(getValue(it)); }}>
                    {getLabel(it)}
                  </button>
                ))}
              </div>
            ));
          })()}
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
      className="fixed inset-0 z-[2000] flex items-center justify-center modal-overlay"
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
