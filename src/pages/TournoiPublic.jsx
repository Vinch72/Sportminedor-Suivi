// src/pages/TournoiPublic.jsx
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import sportminedorLogo from "../assets/sportminedor-logo.png";

// ── Constantes ───────────────────────────────────────────────────────────────
const RED = "#E10600";

const STEP = {
  LOADING:    "loading",
  NOT_FOUND:  "not_found",
  PHONE:      "phone",
  NEW_CLIENT: "new_client",
  RACKET:     "racket",
  CONFIRM:    "confirm",
  SUCCESS:    "success",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtNom = (s) => (s || "").toUpperCase().trim();
const fmtPrenom = (s) =>
  (s || "").trim().toLowerCase().replace(
    /(^|\s|-)([a-zàâäéèêëîïôùûüç])/g,
    (_, sep, l) => sep + l.toUpperCase()
  );

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("33") && digits.length === 11) return "+" + digits;
  if (digits.startsWith("0")  && digits.length === 10)  return "+33" + digits.slice(1);
  return raw.replace(/\s/g, "");
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function TournoiPublic() {
  const params    = new URLSearchParams(window.location.search);
  const tournoiId = params.get("t") || "";

  const [step,         setStep]         = useState(STEP.LOADING);
  const [tournoi,      setTournoi]      = useState(null);
  const [cordages,     setCordages]     = useState([]);
  const [clubs,        setClubs]        = useState([]);
  const [clubsData,    setClubsData]    = useState([]);
  const [tarifMatrix,  setTarifMatrix]  = useState([]);
  const [client,       setClient]       = useState(null);
  const [phone,        setPhone]        = useState("");
  const [phoneErr,     setPhoneErr]     = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [newClient,    setNewClient]    = useState({ nom: "", prenom: "", phone: "", club_id: "" });
  const [clientErr,    setClientErr]    = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [form,    setForm]    = useState({ raquette: "", cordage_id: "", tension: "", notes: "", fourni: false });
  const [formErr, setFormErr] = useState("");
  const [saving,  setSaving]  = useState(false);

  // ── Bloquer navigation arrière ───────────────────────────────────────────
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    function handlePopState() {
      window.history.pushState(null, "", window.location.href);
      setStep(prev => {
        if (prev === STEP.NEW_CLIENT) return STEP.PHONE;
        if (prev === STEP.RACKET)     return STEP.PHONE;
        if (prev === STEP.CONFIRM)    return STEP.RACKET;
        if (prev === STEP.SUCCESS)    return STEP.SUCCESS;
        return prev;
      });
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // ── Chargement initial ───────────────────────────────────────────────────
  useEffect(() => {
    if (!tournoiId) { setStep(STEP.NOT_FOUND); return; }
    async function init() {
      const [rT, rC, rCl, rTm] = await Promise.all([
        supabase.from("tournois").select("tournoi, start_date, end_date, date, infos").eq("tournoi", tournoiId).single(),
        supabase.from("cordages").select("cordage, is_base").order("cordage"),
        supabase.from("clubs").select("clubs, bobine_base, bobine_specific").order("clubs"),
        supabase.from("tarif_matrix").select("*"),
      ]);
      if (rT.error || !rT.data) { setStep(STEP.NOT_FOUND); return; }
      setTournoi(rT.data);
      setCordages(rC.data || []);
      const cl = rCl.data || [];
      setClubs(cl);
      setClubsData(cl);
      setTarifMatrix(rTm.data || []);
      setStep(STEP.PHONE);
    }
    init();
  }, [tournoiId]);

  // ── Calcul prix ──────────────────────────────────────────────────────────
  function computePrice(clubName, cordageId, fourni) {
    if (fourni) return 12;
    const club    = clubsData.find(c => c.clubs === clubName);
    const cordage = cordages.find(c => c.cordage === cordageId);
    if (!club || !cordage) return null;
    const tm = tarifMatrix.find(r =>
      (!!r.bobine_base)     === !!club.bobine_base &&
      (!!r.bobine_specific) === !!club.bobine_specific &&
      (!!r.is_base)         === !!cordage.is_base
    );
    return tm ? (tm.price_cents || 0) / 100 : null;
  }

  function fmtTournoiDate(t) {
    if (!t) return null;
    const fmtD = (d) => {
      if (!d) return null;
      try { return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
      catch { return null; }
    };
    const s = fmtD(t.start_date || t.date);
    const e = fmtD(t.end_date);
    if (s && e && s !== e) return `Du ${s} au ${e}`;
    return s || null;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handlePhoneSubmit(e) {
    e.preventDefault();
    setPhoneErr("");
    const cleaned = phone.replace(/[\s.\-]/g, "");
    const isValid = /^(06|07)\d{8}$/.test(cleaned) || /^\+33[67]\d{8}$/.test(cleaned);
    if (!isValid) { setPhoneErr("Numéro invalide — entre un 06 ou 07 (ex: 06 12 34 56 78)"); return; }
    const normalized = normalizePhone(cleaned);
    setPhoneLoading(true);
    let found = null;
    const r1 = await supabase.from("clients").select("id, nom, prenom, phone, cordage, tension, club").eq("phone", normalized).maybeSingle();
    if (r1.data) found = r1.data;
    else {
      const r2 = await supabase.from("clients").select("id, nom, prenom, phone, cordage, tension, club").eq("phone", phone.replace(/[\s.\-]/g, "")).maybeSingle();
      if (r2.data) found = r2.data;
    }
    setPhoneLoading(false);
    if (found) {
      setClient(found);
      setForm(f => ({ ...f, cordage_id: found.cordage || "", tension: found.tension || "" }));
      setStep(STEP.RACKET);
    } else {
      setNewClient(c => ({ ...c, phone: normalized }));
      setStep(STEP.NEW_CLIENT);
    }
  }

  async function handleNewClientSubmit(e) {
    e.preventDefault();
    setClientErr("");
    if (!newClient.nom.trim())    { setClientErr("Le nom est requis."); return; }
    if (!newClient.prenom.trim()) { setClientErr("Le prénom est requis."); return; }
    if (!newClient.club_id)       { setClientErr("Le club est requis."); return; }
    setSavingClient(true);
    try {
      const { data, error } = await supabase.from("clients").insert({
        nom:    fmtNom(newClient.nom),
        prenom: fmtPrenom(newClient.prenom),
        phone:  newClient.phone,
        club:   newClient.club_id || null,
      }).select("id, nom, prenom, phone, cordage, tension, club").single();
      if (error) throw error;
      setClient(data);
      setStep(STEP.RACKET);
    } catch (err) { setClientErr(err.message); }
    finally { setSavingClient(false); }
  }

  async function handleConfirmSubmit() {
    setSaving(true);
    try {
      const { data: cordData } = await supabase.from("tournoi_cordeurs").select("cordeur").eq("tournoi", tournoiId);
      const cordeurs    = (cordData || []).map(d => d.cordeur);
      const autoCordeur = cordeurs.length === 1 ? cordeurs[0] : null;
      const { error } = await supabase.from("tournoi_raquettes").insert({
        tournoi:    tournoiId,
        client_id:  client.id,
        cordage_id: form.cordage_id,
        tension:    form.tension  || null,
        raquette:   form.raquette || null,
        notes:      form.notes    || null,
        club_id:    client.club   || null,
        cordeur_id: autoCordeur,
        fourni:     form.fourni,
        statut_id:  "A FAIRE",
        exported:   false,
      });
      if (error) throw error;
      setStep(STEP.SUCCESS);
    } catch (err) {
      setFormErr(err.message);
      setStep(STEP.RACKET);
    } finally { setSaving(false); }
  }

  const cordageLabel = cordages.find(c => c.cordage === form.cordage_id)?.cordage || "—";
  const tournoiDate  = fmtTournoiDate(tournoi);
  const prix         = computePrice(client?.club || "", form.cordage_id, form.fourni);
  const prixFmt      = prix !== null ? prix.toFixed(2).replace(".", ",") + " €" : null;
  const showWarn     = [STEP.PHONE, STEP.NEW_CLIENT, STEP.RACKET].includes(step);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0f0f0f" }}>

      {/* ── Header ── */}
      <div className="mx-4 mt-6 mb-2 rounded-2xl shadow-lg px-5 py-5" style={{ background: RED }}>
        <div className="flex items-center gap-4">
          <div className="text-5xl leading-none shrink-0">🏆</div>
          <div className="text-left">
            <div className="font-extrabold text-white leading-tight"
              style={{ fontSize: tournoi?.tournoi && tournoi.tournoi.length > 24 ? "17px" : "22px" }}>
              {tournoi?.tournoi || "Dépôt raquette"}
            </div>
            {tournoiDate && (
              <div className="text-sm font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.80)" }}>
                {tournoiDate}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenu ── */}
      <div className="flex-1 flex flex-col items-center px-4 pb-8 gap-3 max-w-md mx-auto w-full">

        {/* Warning décordage */}
        {showWarn && (
          <div className="w-full rounded-2xl border px-4 py-3 flex items-start gap-3 text-sm font-medium"
            style={{ background: "rgba(225,6,0,0.08)", borderColor: "rgba(225,6,0,0.25)", color: "#fca5a5" }}>
            <span className="shrink-0">⚠️</span>
            <span>Merci de bien <strong>décorder ta raquette</strong> avant de la déposer pour nous faire gagner du temps !</span>
          </div>
        )}

        {/* ── LOADING ── */}
        {step === STEP.LOADING && (
          <Card><div className="text-center py-10 text-gray-400 text-sm">Chargement…</div></Card>
        )}

        {/* ── NOT FOUND ── */}
        {step === STEP.NOT_FOUND && (
          <Card>
            <div className="text-center py-10 space-y-3">
              <div className="text-5xl">😕</div>
              <div className="text-xl font-bold text-gray-900">Tournoi introuvable</div>
              <div className="text-sm text-gray-500">Ce QR code est invalide ou expiré.</div>
            </div>
          </Card>
        )}

        {/* ── ÉTAPE 1 : Téléphone ── */}
        {step === STEP.PHONE && (
          <Card>
            <div className="text-center mb-5">
              <div className="text-3xl mb-2">🏸</div>
              <div className="text-xl font-bold text-gray-900">Dépose ta raquette !</div>
              <p className="text-sm text-gray-500 mt-1 mb-4">Service de cordage du tournoi</p>
              <div className="flex items-center justify-center gap-2 mb-2">
                {[
                  { icon: "📱", label: "Ton numéro" },
                  { icon: "🏸", label: "Ta raquette" },
                  { icon: "✅", label: "C'est tout !" },
                ].map((s, i, arr) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg text-white"
                        style={{ background: RED }}>{s.icon}</div>
                      <span className="text-xs text-gray-500">{s.label}</span>
                    </div>
                    {i < arr.length - 1 && <span className="text-gray-300 text-lg mb-4">→</span>}
                  </div>
                ))}
              </div>
            </div>

            {tournoiDate && (
              <div className="flex items-center gap-3 rounded-xl border px-4 py-3 mb-4"
                style={{ background: "rgba(225,6,0,0.05)", borderColor: "rgba(225,6,0,0.18)" }}>
                <span className="text-lg shrink-0">📅</span>
                <div>
                  <div className="text-sm font-semibold" style={{ color: RED }}>{tournoiDate}</div>
                  <div className="text-xs text-gray-500">Dépose ta raquette, on s'occupe du reste !</div>
                </div>
              </div>
            )}

            <form onSubmit={handlePhoneSubmit}>
              <label className="block mb-1 text-sm font-medium text-gray-700">Ton numéro de téléphone</label>
              <input type="tel" inputMode="tel" autoFocus
                className="w-full border-2 rounded-xl px-4 h-12 text-lg focus:outline-none transition"
                style={{ borderColor: RED }}
                placeholder="06 12 34 56 78"
                value={phone} onChange={e => setPhone(e.target.value)} />
              {phoneErr && <p className="mt-2 text-sm text-red-600 font-medium">{phoneErr}</p>}
              <Btn type="submit" className="mt-4 w-full" loading={phoneLoading}>Continuer →</Btn>
            </form>

            {/* Logo Sportminedor centré */}
            <div className="mt-5 pt-4 border-t flex justify-center">
              <img src={sportminedorLogo} alt="Sportminedor"
                className="h-8 object-contain opacity-80"
                onError={e => e.target.style.display = "none"} />
            </div>

            <p className="text-xs text-gray-400 text-center mt-3">
              En continuant, vous acceptez que vos données (nom, téléphone) soient
              collectées par <b>Sportminedor</b> pour la gestion de votre cordage.
              Conformément au RGPD, vous pouvez demander leur suppression à :{" "}
              <a href="mailto:franck.dessaux@sportminedor.com" className="underline">
                franck.dessaux@sportminedor.com
              </a>.
            </p>
          </Card>
        )}

        {/* ── ÉTAPE 2 : Nouveau client ── */}
        {step === STEP.NEW_CLIENT && (
          <Card title="📋 Première visite" subtitle="Crée ta fiche joueur en quelques secondes.">
            <form onSubmit={handleNewClientSubmit}>
              <div className="space-y-3">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Nom *</label>
                  <input autoFocus className="w-full border-2 rounded-xl px-4 h-11 focus:outline-none transition"
                    style={{ borderColor: RED }} placeholder="DUPONT" value={newClient.nom}
                    onChange={e => setNewClient(c => ({ ...c, nom: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Prénom *</label>
                  <input className="w-full border-2 rounded-xl px-4 h-11 focus:outline-none transition"
                    style={{ borderColor: RED }} placeholder="Jean" value={newClient.prenom}
                    onChange={e => setNewClient(c => ({ ...c, prenom: fmtPrenom(e.target.value) }))} />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Téléphone</label>
                  <input className="w-full border rounded-xl px-4 h-11 bg-gray-50 text-gray-500 text-sm"
                    value={newClient.phone} readOnly />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Club *</label>
                  <select className="w-full border-2 rounded-xl px-4 h-11 bg-white text-sm focus:outline-none transition"
                    style={{ borderColor: newClient.club_id ? RED : "#e5e7eb" }}
                    value={newClient.club_id}
                    onChange={e => setNewClient(c => ({ ...c, club_id: e.target.value }))}>
                    <option value="">— Choisir un club —</option>
                    {clubs.map(cl => <option key={cl.clubs} value={cl.clubs}>{cl.clubs}</option>)}
                  </select>
                </div>
              </div>
              {clientErr && <p className="mt-3 text-sm text-red-600 font-medium">{clientErr}</p>}
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => { setStep(STEP.PHONE); setPhone(""); }}
                  className="flex-1 h-11 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">← Retour</button>
                <Btn type="submit" className="flex-1" loading={savingClient}>Créer mon profil →</Btn>
              </div>
            </form>
          </Card>
        )}

        {/* ── ÉTAPE 3 : Raquette ── */}
        {step === STEP.RACKET && client && (
          <Card>
            {/* Carte client */}
            <div className="flex items-center gap-3 rounded-xl p-3 mb-5"
              style={{ background: "rgba(225,6,0,0.06)", border: "1.5px solid rgba(225,6,0,0.15)" }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ background: RED }}>
                {(fmtPrenom(client.prenom) || fmtNom(client.nom) || "?")[0].toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-gray-900">Bonjour {fmtPrenom(client.prenom)} ! 👋</div>
                <div className="text-xs text-gray-500">{client.phone}</div>
              </div>
            </div>

            <div className="text-base font-bold text-gray-900 mb-4">Quelle raquette dépose-tu aujourd'hui ?</div>

            <form onSubmit={e => {
              e.preventDefault();
              if (!form.raquette.trim())  { setFormErr("Le modèle de raquette est requis."); return; }
              if (!client.club)           { setFormErr("Le club est requis."); return; }
              if (!form.cordage_id)       { setFormErr("Le cordage est requis."); return; }
              if (!form.tension.trim())   { setFormErr("La tension est requise."); return; }
              setFormErr(""); setStep(STEP.CONFIRM);
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Ton club</label>
                  <select className="w-full border-2 rounded-xl px-4 h-11 bg-white text-sm focus:outline-none transition"
                    style={{ borderColor: client.club ? RED : "#e5e7eb" }}
                    value={client.club || ""}
                    onChange={e => setClient(c => ({ ...c, club: e.target.value }))}>
                    <option value="">— Aucun club —</option>
                    {clubs.map(cl => <option key={cl.clubs} value={cl.clubs}>{cl.clubs}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Raquette</label>
                  <input className="w-full border-2 rounded-xl px-4 h-11 text-sm focus:outline-none transition"
                    style={{ borderColor: form.raquette ? RED : "#e5e7eb" }}
                    placeholder="YONEX ASTROX 88S PRO" value={form.raquette}
                    onChange={e => setForm(f => ({ ...f, raquette: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Cordage
                    <span className="ml-1 text-xs text-gray-400 font-normal">(demande si ton cordage est disponible)</span>
                  </label>
                  <select className="w-full border-2 rounded-xl px-4 h-11 bg-white text-sm focus:outline-none transition"
                    style={{ borderColor: form.cordage_id ? RED : "#e5e7eb" }}
                    value={form.cordage_id}
                    onChange={e => setForm(f => ({ ...f, cordage_id: e.target.value }))}>
                    <option value="">— Choisir un cordage —</option>
                    {cordages.map(c => (
                      <option key={c.cordage} value={c.cordage}>
                        {c.cordage}{c.is_base ? " [Classique]" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Tension
                    <span className="ml-1 text-xs text-gray-400 font-normal">(ex: 11 ou 11-11,5)</span>
                  </label>
                  <input className="w-full border-2 rounded-xl px-4 h-11 text-sm focus:outline-none transition"
                    style={{ borderColor: form.tension ? RED : "#e5e7eb" }}
                    placeholder="11" value={form.tension}
                    onChange={e => setForm(f => ({ ...f, tension: e.target.value }))} />
                </div>

                {/* Cordage fourni */}
                <button type="button" onClick={() => setForm(f => ({ ...f, fourni: !f.fourni }))}
                  className="w-full flex items-center gap-3 px-4 h-12 rounded-xl border-2 transition text-left"
                  style={form.fourni
                    ? { borderColor: RED, background: "rgba(225,6,0,0.05)" }
                    : { borderColor: "#e5e7eb", background: "#fff" }}>
                  <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition"
                    style={form.fourni ? { background: RED, borderColor: RED } : { borderColor: "#d1d5db" }}>
                    {form.fourni && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Je fournis mon cordage</div>
                    <div className="text-xs text-gray-500">Coche si tu apportes toi-même le cordage</div>
                  </div>
                </button>

                {/* Notes */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Message / demande spéciale
                    <span className="ml-1 text-xs text-gray-400 font-normal">(optionnel)</span>
                  </label>
                  <textarea
                    className="w-full border-2 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none transition"
                    style={{ borderColor: form.notes ? RED : "#e5e7eb" }}
                    rows={3}
                    placeholder="Ex: tension un peu plus serrée, raquette fragile au manche…"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                {/* Tarif estimé */}
                {prixFmt && form.cordage_id && (
                  <div className="flex items-center justify-between rounded-xl border-2 px-4 py-3"
                    style={{ borderColor: "#bae6fd", background: "#f0f9ff" }}>
                    <div>
                      <div className="text-xs text-blue-700 uppercase tracking-wide font-medium">À payer</div>
                      {form.fourni && <div className="text-xs text-blue-500 mt-0.5">Cordage fourni</div>}
                      <div className="text-2xl font-extrabold text-blue-700">{prixFmt}</div>
                    </div>
                    <div className="text-3xl">💶</div>
                  </div>
                )}
              </div>

              {formErr && <p className="mt-3 text-sm text-red-600 font-medium">{formErr}</p>}

              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setStep(STEP.PHONE)}
                  className="flex-1 h-11 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">← Retour</button>
                <Btn type="submit" className="flex-1">Vérifier →</Btn>
              </div>
            </form>
          </Card>
        )}

        {/* ── ÉTAPE 4 : Confirmation ── */}
        {step === STEP.CONFIRM && client && (
          <Card title="✅ Dépôt de ta raquette" subtitle="Vérifie les informations avant d'envoyer">
            <div className="rounded-xl border overflow-hidden">
              {[
                { label: "Tournoi",        value: tournoi?.tournoi },
                { label: "Client",         value: `${fmtNom(client.nom)} ${fmtPrenom(client.prenom)}` },
                { label: "Téléphone",      value: client.phone },
                { label: "Raquette",       value: form.raquette || "—" },
                { label: "Club",           value: client.club || "—" },
                { label: "Cordage",        value: cordageLabel },
                { label: "Tension",        value: form.tension || "—" },
                { label: "Cordage fourni", value: form.fourni ? "Oui" : "Non" },
                ...(form.notes ? [{ label: "Notes", value: form.notes }] : []),
              ].map(({ label, value }, i, arr) => (
                <div key={label}
                  className="flex justify-between items-start gap-4 px-4 py-3"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid #f4f4f5" : "none" }}>
                  <span className="text-sm text-gray-500 shrink-0">{label}</span>
                  <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
                </div>
              ))}
              {prixFmt && (
                <div className="flex justify-between items-center px-4 py-3"
                  style={{ background: "#f0f9ff", borderTop: "1.5px solid #bae6fd" }}>
                  <span className="text-sm font-bold text-blue-700">À payer</span>
                  <span className="text-xl font-extrabold text-blue-700">{prixFmt}</span>
                </div>
              )}
            </div>
            {formErr && <p className="mt-3 text-sm text-red-600 font-medium">{formErr}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setStep(STEP.RACKET)}
                className="flex-1 h-11 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">← Modifier</button>
              <Btn className="flex-1" onClick={handleConfirmSubmit} loading={saving}>🏸 Déposer ma raquette</Btn>
            </div>
          </Card>
        )}

        {/* ── ÉTAPE 5 : Succès ── */}
        {step === STEP.SUCCESS && (
          <Card>
            <div className="text-center py-6 space-y-4">
              <div className="text-6xl">🎉</div>
              <div className="text-xl font-bold text-gray-900">Raquette enregistrée !</div>
              <p className="text-sm text-gray-500 leading-relaxed">
                Le dépôt de ta raquette au tournoi <b>{tournoi?.tournoi}</b> a bien été enregistré.<br />
                Le cordeur a été notifié et s'occupera de ta raquette.<br />
                Pense bien à <b>décorder ta raquette</b> !
              </p>
              {prixFmt && (
                <div className="rounded-xl border-2 px-5 py-4 inline-block"
                  style={{ borderColor: "#bae6fd", background: "#f0f9ff" }}>
                  <div className="text-xs text-blue-600 uppercase tracking-wide font-medium mb-1">À payer au cordeur</div>
                  <div className="text-3xl font-extrabold text-blue-700">{prixFmt}</div>
                </div>
              )}
              <button type="button"
                onClick={() => {
                  setStep(STEP.PHONE); setPhone(""); setClient(null);
                  setForm({ raquette: "", cordage_id: "", tension: "", notes: "", fourni: false });
                }}
                className="w-full h-11 rounded-xl border-2 text-sm font-semibold transition"
                style={{ borderColor: RED, color: RED, background: "#fff" }}>
                🏸 Déposer une autre raquette
              </button>
            </div>
          </Card>
        )}

        <div className="text-xs text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
          Sportminedor — Suivi cordage ·{" "}
          <a href="/mentions-legales" className="underline">Mentions légales</a>
        </div>
      </div>
    </div>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Card({ title, subtitle, children }) {
  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      {title    && <div className="text-lg font-bold text-gray-900 mb-1">{title}</div>}
      {subtitle && <div className="text-sm text-gray-500 mb-4">{subtitle}</div>}
      {children}
    </div>
  );
}

function Btn({ children, onClick, loading, disabled, type = "button", className = "" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      className={`h-11 rounded-xl text-white font-bold text-sm transition disabled:opacity-40 ${className}`}
      style={{ background: RED }}>
      {loading ? "…" : children}
    </button>
  );
}