// src/pages/TournoiPublic.jsx
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const fmtNom = (s) => (s || "").toUpperCase().trim();
const fmtPrenom = (s) =>
  (s || "").trim().toLowerCase().replace(
    /(^|\s|-)([a-zàâäéèêëîïôùûüç])/g,
    (_, sep, l) => sep + l.toUpperCase()
  );

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("33") && digits.length === 11) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+33" + digits.slice(1);
  return raw.replace(/\s/g, "");
}

const STEP = {
  LOADING: "loading", NOT_FOUND: "not_found", PHONE: "phone",
  NEW_CLIENT: "new_client", RACKET: "racket", CONFIRM: "confirm", SUCCESS: "success",
};

const RED = "#E10600";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
.tp{min-height:100vh;background:#f4f4f5;display:flex;flex-direction:column;align-items:center;padding-bottom:60px;font-family:'Outfit',sans-serif;}
.tp-header{width:100%;background:${RED};padding:20px 24px;display:flex;align-items:center;gap:16px;margin-bottom:20px;}
.tp-header-icon{width:50px;height:50px;background:rgba(0,0,0,0.18);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;}
.tp-header-title{color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.03em;line-height:1.1;}
.tp-header-sub{color:rgba(255,255,255,0.78);font-size:13px;font-weight:500;margin-top:3px;}
.tp-inner{width:100%;max-width:480px;padding:0 16px;display:flex;flex-direction:column;align-items:stretch;}
.tp-warn{background:#fff8f0;border:1.5px solid #fcd9a0;border-radius:14px;padding:12px 16px;font-size:13px;font-weight:500;color:#92400e;display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;}
.tp-card{background:#fff;border-radius:20px;box-shadow:0 2px 16px rgba(0,0,0,0.08);overflow:hidden;margin-bottom:24px;}
.tp-body{padding:24px;}
.tp-h1{font-size:20px;font-weight:800;color:#111;margin-bottom:4px;}
.tp-sub{font-size:14px;color:#71717a;margin-bottom:20px;}
.tp-label{display:block;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:7px;}
.tp-label em{color:${RED};font-style:normal;}
.tp-field{margin-bottom:16px;}
.tp-input{width:100%;height:50px;border:1.5px solid #e4e4e7;border-radius:12px;padding:0 16px;font-size:15px;font-family:'Outfit',sans-serif;font-weight:500;color:#111;background:#fff;outline:none;transition:border-color 0.15s;-webkit-appearance:none;appearance:none;}
.tp-input:focus{border-color:${RED};}
.tp-input.lg{height:58px;font-size:20px;font-weight:600;}
.tp-input.ro{background:#f9f9f9;color:#71717a;}
textarea.tp-input{height:88px;padding:14px 16px;resize:none;line-height:1.5;}
.tp-err{font-size:13px;color:#dc2626;margin-top:6px;font-weight:500;}
.tp-btn-row{display:flex;gap:10px;margin-top:22px;}
.tp-btn{flex:1;height:52px;border-radius:14px;font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;border:none;cursor:pointer;transition:opacity 0.15s,transform 0.1s;letter-spacing:0.01em;}
.tp-btn:active{transform:scale(0.98);}
.tp-btn:disabled{opacity:.55;cursor:not-allowed;}
.tp-btn.red{background:${RED};color:#fff;}
.tp-btn.red:hover:not(:disabled){opacity:.9;}
.tp-btn.ghost{background:#f4f4f5;color:#3f3f46;flex:0 0 auto;padding:0 20px;}
.tp-btn.ghost:hover{background:#e4e4e7;}
.tp-btn.full{width:100%;flex:none;margin-top:18px;}
.tp-client-card{display:flex;align-items:center;gap:14px;padding:14px 16px;background:#f9f9f9;border-radius:14px;margin-bottom:20px;border:1.5px solid #f0f0f0;}
.tp-avatar{width:46px;height:46px;border-radius:50%;background:${RED};color:#fff;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tp-client-name{font-size:16px;font-weight:700;color:#111;}
.tp-client-phone{font-size:13px;color:#71717a;margin-top:1px;}
.tp-check{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1.5px solid #e4e4e7;border-radius:12px;cursor:pointer;transition:border-color 0.15s,background 0.15s;user-select:none;}
.tp-check:hover{border-color:#d4d4d8;background:#fafafa;}
.tp-check.on{border-color:${RED};background:#fff5f5;}
.tp-check-box{width:22px;height:22px;border-radius:6px;border:2px solid #d4d4d8;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;}
.tp-check.on .tp-check-box{background:${RED};border-color:${RED};}
.tp-check-lbl{font-weight:600;font-size:14px;color:#27272a;}
.tp-check-sub{font-size:12px;color:#71717a;margin-top:1px;}
.tp-price{background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:14px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;margin-top:16px;}
.tp-price-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0369a1;}
.tp-price-amt{font-size:26px;font-weight:900;color:#0369a1;letter-spacing:-0.03em;}
.tp-table{border:1.5px solid #e4e4e7;border-radius:16px;overflow:hidden;margin-top:16px;}
.tp-row{display:flex;justify-content:space-between;align-items:flex-start;padding:13px 18px;border-bottom:1px solid #f0f0f0;gap:16px;}
.tp-row:last-child{border-bottom:none;}
.tp-row-k{font-size:13px;color:#71717a;font-weight:500;flex-shrink:0;}
.tp-row-v{font-size:14px;font-weight:700;color:#111;text-align:right;}
.tp-row.price-row{background:#f0f9ff;border-top:1.5px solid #bae6fd;}
.tp-confirm-header{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
.tp-ok-badge{width:32px;height:32px;border-radius:50%;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0;}
.tp-success{text-align:center;padding:28px 8px;display:flex;flex-direction:column;align-items:center;gap:14px;}
.tp-success-emoji{font-size:64px;line-height:1;}
.tp-success-title{font-size:24px;font-weight:900;color:#111;}
.tp-success-sub{font-size:14px;color:#71717a;line-height:1.65;max-width:300px;}
.tp-pay-box{background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:16px;padding:18px 24px;text-align:center;width:100%;}
.tp-pay-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0369a1;margin-bottom:4px;}
.tp-pay-amt{font-size:32px;font-weight:900;color:#0369a1;letter-spacing:-0.03em;}
.tp-footer{text-align:center;font-size:12px;color:#a1a1aa;font-weight:500;}
.tp-date-box{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#eff6ff;border-radius:12px;margin-bottom:22px;border:1px solid #bfdbfe;}
.tp-date-lbl{font-size:13px;font-weight:600;color:#1d4ed8;}
.tp-date-sub{font-size:12px;color:#3b82f6;margin-top:1px;}
`;

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
  const [form, setForm] = useState({ raquette: "", cordage_id: "", tension: "", notes: "", fourni: false });
  const [formErr, setFormErr] = useState("");
  const [saving,  setSaving]  = useState(false);

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

  function computePrice(clubName, cordageId, fourni) {
    if (fourni) return 12;
    const club = clubsData.find(c => c.clubs === clubName);
    const cordage = cordages.find(c => c.cordage === cordageId);
    if (!club || !cordage) return null;
    const tm = tarifMatrix.find(r =>
      (!!r.bobine_base) === !!club.bobine_base &&
      (!!r.bobine_specific) === !!club.bobine_specific &&
      (!!r.is_base) === !!cordage.is_base
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

  async function handlePhoneSubmit(e) {
    e.preventDefault();
    setPhoneErr("");
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length < 8) { setPhoneErr("Numéro trop court."); return; }
    const normalized = normalizePhone(cleaned);
    setPhoneLoading(true);
    let found = null;
    const r1 = await supabase.from("clients").select("id, nom, prenom, phone, cordage, tension, club").eq("phone", normalized).maybeSingle();
    if (r1.data) found = r1.data;
    else {
      const r2 = await supabase.from("clients").select("id, nom, prenom, phone, cordage, tension, club").eq("phone", cleaned).maybeSingle();
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
        nom: fmtNom(newClient.nom), prenom: fmtPrenom(newClient.prenom),
        phone: newClient.phone, club: newClient.club_id || null,
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
      const cordeurs = (cordData || []).map(d => d.cordeur);
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

  const showWarn = [STEP.PHONE, STEP.NEW_CLIENT, STEP.RACKET].includes(step);

  return (
    <>
      <style>{CSS}</style>
      <div className="tp">

        {/* Header */}
        <div className="tp-header">
          <div className="tp-header-icon">🏸</div>
          <div>
            <div className="tp-header-title">Dépôt raquette</div>
            {tournoi && <div className="tp-header-sub">{tournoi.tournoi}</div>}
          </div>
        </div>

        <div className="tp-inner">

          {/* Warning décordage */}
          {showWarn && (
            <div className="tp-warn">
              <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
              <span>Merci de bien <strong>décorder ta raquette</strong> avant de la déposer pour nous faire gagner du temps !</span>
            </div>
          )}

          <div className="tp-card">
            <div className="tp-body">

              {/* LOADING */}
              {step === STEP.LOADING && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#a1a1aa", fontSize: "15px" }}>Chargement...</div>
              )}

              {/* NOT FOUND */}
              {step === STEP.NOT_FOUND && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ fontSize: "52px" }}>😕</div>
                  <div style={{ fontWeight: "800", fontSize: "20px", marginTop: "14px", color: "#111" }}>Tournoi introuvable</div>
                  <div style={{ color: "#71717a", fontSize: "14px", marginTop: "6px" }}>Ce QR code est invalide ou expiré.</div>
                </div>
              )}

              {/* ETAPE 1 : Téléphone */}
              {step === STEP.PHONE && (
                <form onSubmit={handlePhoneSubmit}>
                  {tournoiDate && (
                    <div className="tp-date-box">
                      <span style={{ fontSize: "18px" }}>📅</span>
                      <div>
                        <div className="tp-date-lbl">{tournoiDate}</div>
                        <div className="tp-date-sub">Dépose ta raquette et on s'occupe du reste !</div>
                      </div>
                    </div>
                  )}
                  <div className="tp-h1">Ton numéro de téléphone</div>
                  <div className="tp-sub">On vérifie si tu es déjà dans notre système.</div>
                  <div className="tp-field">
                    <label className="tp-label">Téléphone</label>
                    <input type="tel" inputMode="tel" autoFocus className="tp-input lg"
                      placeholder="06 12 34 56 78" value={phone}
                      onChange={(e) => setPhone(e.target.value)} />
                    {phoneErr && <div className="tp-err">{phoneErr}</div>}
                  </div>
                  <button type="submit" disabled={phoneLoading} className="tp-btn red full">
                    {phoneLoading ? "Recherche..." : "Continuer →"}
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-3">
                    En continuant, vous acceptez que vos données (nom, téléphone) soient 
                    collectées par <b>Sportminedor</b> pour la gestion de votre cordage. 
                    Conformément au RGPD, vous pouvez demander leur suppression à 
                    <a href="mailto:franck.dessaux@sportminedor.com" className="underline"> franck.dessaux@sportminedor.com</a>.
                  </p>
                </form>
              )}

              {/* ETAPE 2 : Nouveau client */}
              {step === STEP.NEW_CLIENT && (
                <form onSubmit={handleNewClientSubmit}>
                  <div className="tp-h1">Première visite 👋</div>
                  <div className="tp-sub">Crée ta fiche joueur en quelques secondes.</div>
                  <div className="tp-field">
                    <label className="tp-label">Nom <em>*</em></label>
                    <input autoFocus className="tp-input" placeholder="DUPONT" value={newClient.nom}
                      onChange={(e) => setNewClient(c => ({ ...c, nom: e.target.value.toUpperCase() }))} />
                  </div>
                  <div className="tp-field">
                    <label className="tp-label">Prénom <em>*</em></label>
                    <input className="tp-input" placeholder="Jean" value={newClient.prenom}
                      onChange={(e) => setNewClient(c => ({ ...c, prenom: fmtPrenom(e.target.value) }))} />
                  </div>
                  <div className="tp-field">
                    <label className="tp-label">Téléphone</label>
                    <input className="tp-input ro" value={newClient.phone} readOnly />
                  </div>
                  <div className="tp-field">
                    <label className="tp-label">Club</label>
                    <select className="tp-input" value={newClient.club_id}
                      onChange={(e) => setNewClient(c => ({ ...c, club_id: e.target.value }))}>
                      <option value="">-- Aucun club --</option>
                      {clubs.map(cl => <option key={cl.clubs} value={cl.clubs}>{cl.clubs}</option>)}
                    </select>
                  </div>
                  {clientErr && <div className="tp-err" style={{ marginBottom: "12px" }}>{clientErr}</div>}
                  <div className="tp-btn-row">
                    <button type="button" className="tp-btn ghost" onClick={() => { setStep(STEP.PHONE); setPhone(""); }}>← Retour</button>
                    <button type="submit" disabled={savingClient} className="tp-btn red">
                      {savingClient ? "Création..." : "Créer mon profil →"}
                    </button>
                  </div>
                </form>
              )}

              {/* ETAPE 3 : Raquette */}
              {step === STEP.RACKET && client && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.raquette.trim())  { setFormErr("Le modèle de raquette est requis."); return; }
                  if (!client.club)           { setFormErr("Le club est requis."); return; }
                  if (!form.cordage_id)       { setFormErr("Le cordage est requis."); return; }
                  if (!form.tension.trim())   { setFormErr("La tension est requise."); return; }
                  setFormErr(""); setStep(STEP.CONFIRM);
                }}>
                  <div className="tp-client-card">
                    <div className="tp-avatar">{(client.prenom || client.nom || "?")[0].toUpperCase()}</div>
                    <div>
                      <div className="tp-client-name">Bonjour {fmtPrenom(client.prenom)} ! 👋</div>
                      <div className="tp-client-phone">{client.phone}</div>
                    </div>
                  </div>

                  <div className="tp-h1" style={{ fontSize: "16px", marginBottom: "16px" }}>Quelle raquette dépose-tu aujourd'hui ?</div>

                  <div className="tp-field">
                    <label className="tp-label">Ton club</label>
                    <select className="tp-input" value={client.club || ""}
                      onChange={(e) => setClient(c => ({ ...c, club: e.target.value }))}>
                      <option value="">-- Aucun club --</option>
                      {clubs.map(cl => <option key={cl.clubs} value={cl.clubs}>{cl.clubs}</option>)}
                    </select>
                  </div>

                  <div className="tp-field">
                    <label className="tp-label">Raquette</label>
                    <input className="tp-input" placeholder="YONEX ASTROX 88S PRO" value={form.raquette}
                      onChange={(e) => setForm(f => ({ ...f, raquette: e.target.value.toUpperCase() }))} />
                  </div>

                  <div className="tp-field">
                    <label className="tp-label">Cordage <em style={{ color: "#a1a1aa", textTransform: "none", fontSize: "11px", fontWeight: "500" }}>(demande si ton cordage est disponible)</em></label>
                    <select className="tp-input" value={form.cordage_id}
                      onChange={(e) => setForm(f => ({ ...f, cordage_id: e.target.value }))}>
                      <option value="">-- Choisir un cordage --</option>
                      {cordages.map(c => (
                        <option key={c.cordage} value={c.cordage}>{c.cordage}{c.is_base ? " [Classique]" : ""}</option>
                      ))}
                    </select>
                  </div>

                  <div className="tp-field">
                    <label className="tp-label">Tension <em style={{ color: "#a1a1aa", textTransform: "none", fontSize: "11px", fontWeight: "500" }}>(ex: 11 ou 11-11,5)</em></label>
                    <input className="tp-input" placeholder="11" value={form.tension}
                      onChange={(e) => setForm(f => ({ ...f, tension: e.target.value }))} />
                  </div>

                  <div className="tp-field">
                    <div className={`tp-check ${form.fourni ? "on" : ""}`} onClick={() => setForm(f => ({ ...f, fourni: !f.fourni }))}>
                      <div className="tp-check-box">
                        {form.fourni && (
                          <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                            <path d="M1.5 5L5 8.5L11.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="tp-check-lbl">Je fournis mon cordage</div>
                        <div className="tp-check-sub">Coche si tu apportes toi-même le cordage</div>
                      </div>
                    </div>
                  </div>

                  <div className="tp-field">
                    <label className="tp-label">Message / demande spéciale <em style={{ color: "#a1a1aa", textTransform: "none", fontSize: "11px", fontWeight: "500" }}>(optionnel)</em></label>
                    <textarea className="tp-input" placeholder="Ex: tension un peu plus serrée, raquette fragile au manche..."
                      value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>

                  {prixFmt && form.cordage_id && (
                    <div className="tp-price">
                      <div>
                        <div className="tp-price-lbl">À payer</div>
                        {form.fourni && <div style={{ fontSize: "11px", color: "#0369a1", marginTop: "2px" }}>Cordage fourni</div>}
                      </div>
                      <div className="tp-price-amt">{prixFmt}</div>
                    </div>
                  )}

                  {formErr && <div className="tp-err" style={{ marginTop: "12px" }}>{formErr}</div>}

                  <div className="tp-btn-row">
                    <button type="button" className="tp-btn ghost" onClick={() => setStep(STEP.PHONE)}>← Retour</button>
                    <button type="submit" className="tp-btn red">Vérifier →</button>
                  </div>
                </form>
              )}

              {/* ETAPE 4 : Confirmation */}
              {step === STEP.CONFIRM && client && (
                <div>
                  <div className="tp-confirm-header">
                    <div className="tp-ok-badge">✓</div>
                    <div>
                      <div className="tp-h1" style={{ fontSize: "18px" }}>Confirmer l'inscription</div>
                      <div style={{ color: "#71717a", fontSize: "13px" }}>Vérifie les informations avant d'envoyer</div>
                    </div>
                  </div>
                  <div className="tp-table">
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
                      <div key={label} className="tp-row" style={{ borderBottom: i < arr.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                        <span className="tp-row-k">{label}</span>
                        <span className="tp-row-v">{value}</span>
                      </div>
                    ))}
                    {prixFmt && (
                      <div className="tp-row price-row">
                        <span style={{ fontSize: "13px", color: "#0369a1", fontWeight: "700" }}>À payer</span>
                        <span style={{ fontSize: "18px", fontWeight: "900", color: "#0369a1" }}>{prixFmt}</span>
                      </div>
                    )}
                  </div>
                  {formErr && <div className="tp-err" style={{ marginTop: "12px" }}>{formErr}</div>}
                  <div className="tp-btn-row">
                    <button type="button" className="tp-btn ghost" onClick={() => setStep(STEP.RACKET)}>← Modifier</button>
                    <button type="button" disabled={saving} onClick={handleConfirmSubmit} className="tp-btn red">
                      {saving ? "Envoi..." : "🏸 S'inscrire"}
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPE 5 : Succès */}
              {step === STEP.SUCCESS && (
                <div className="tp-success">
                  <div className="tp-success-emoji">🎉</div>
                  <div className="tp-success-title">Raquette enregistrée !</div>
                  <div className="tp-success-sub">
                    Le dépôt de ta raquette au tournoi : <strong>{tournoi?.tournoi}</strong> a bien été enregistrée.<br />
                    Le cordeur a été notifié et s'occupera de ta raquette.
                    Pense bien à décorder ta raquette !
                  </div>
                  {prixFmt && (
                    <div className="tp-pay-box">
                      <div className="tp-pay-lbl">À payer au cordeur</div>
                      <div className="tp-pay-amt">{prixFmt}</div>
                    </div>
                  )}
                  <div style={{ fontSize: "13px", color: "#71717a" }}>Tu peux fermer cette page ou...↓</div>
                  <button type="button" className="tp-btn ghost full" style={{ marginTop: "0" }}
                    onClick={() => { setStep(STEP.PHONE); setPhone(""); setClient(null); setForm({ raquette: "", cordage_id: "", tension: "", notes: "", fourni: false }); }}>
                    Déposer une autre raquette
                  </button>
                </div>
              )}

            </div>
          </div>

          <div className="tp-footer">
            Sportminedor — Suivi cordage · <a href="/mentions-legales" style={{ color: "#a1a1aa", textDecoration: "underline" }}>Mentions légales</a>
          </div>
        </div>
      </div>
    </>
  );
}