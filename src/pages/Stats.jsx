// src/pages/Stats.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import logo from "../assets/sportminedor-logo.png";
import MonthlyRevenueChart from "../components/stats/MonthlyRevenueChart.jsx";
import { computeGainCordeur } from "../utils/computeGainCordeur";

/** ===== Helpers ===== */
const FR_MONTHS = ["Janv.","Fév.","Mars","Avr.","Mai","Juin","Juil.","Août","Sept.","Oct.","Nov.","Déc."];

function dateISO(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function rowISODate(v){
  if (!v) return "";
  // si c’est déjà "YYYY-MM-DD" ou "YYYY-MM-DDTHH..."
  return String(v).slice(0, 10);
}

function pad2(n){ return String(n).padStart(2,"0"); }
function monthKey(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; }
function monthLabel(ym){ const [y,m]=ym.split("-").map(Number); return `${FR_MONTHS[(m-1+12)%12]} ${y}`; }

function getSeasonBounds(today=new Date()){
  const y=today.getFullYear(), m=today.getMonth(); // 0=janv
  const startYear = m>=8 ? y : y-1;

  const start = new Date(startYear, 8, 1);                 // 1 sept
  const end   = new Date(startYear+1, 7, 31, 23,59,59,999); // 31 août inclus

  return { start, end, startISO: dateISO(start), endISO: dateISO(end) };
}

function getMonthBounds(today=new Date()){
  const y=today.getFullYear(), m=today.getMonth();
  const start=new Date(y,m,1);
  const end=new Date(y,m+1,0,23,59,59,999);

  return { start, end, startISO: dateISO(start), endISO: dateISO(end) };
}

const norm = (s)=> (s||"").normalize("NFD").replace(/\p{Diacritic}/gu,"").toUpperCase();
const isDone = (statut)=> norm(statut)!=="A FAIRE";
const euro = (n)=> `${(Number(n)||0).toLocaleString("fr-FR",{minimumFractionDigits:0, maximumFractionDigits:2})} €`;
const parseMoney = (v)=>{
  if (v==null) return 0;
  const s=String(v).replace(/\s/g,"");
  const m=s.match(/-?\d+(?:[.,]\d+)?/);
  return m? parseFloat(m[0].replace(",", ".")) : 0;
};

// Cordeurs éligibles à la rémunération magasin (6 € / raquette)
const CORDEURS_MAGASIN = new Set(["Seul","Constant","Kellian","Vincenzo","Matéo","Mickaël"]);
// Valeur par défaut si cordage non reconnu
const DEFAULT_GAIN_EUR = 6;

const canon = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ""); // enlève espaces, tirets, etc.

const cordageKey = (s) => {
  const c = canon(s);

  // cas Pose
  if (c.includes("POSE")) return "POSE";

  // essaye d’extraire un code “marque+numéro” connu
  // BG65 / BG80 / BG80POWER / BG66... / EXBOLT65 / NANOGY98 / AEROBITE / SKYARC
  const m =
    c.match(/(BG80POWER|BG80|BG65|BG66|EXBOLT63|EXBOLT65|EXBOLT68|NANOGY95|NANOGY98|NANOGY99|AEROBITE|SKYARC)/);

  return m ? m[1] : c; // fallback
};

const isMagasin = (v) => canon(v) === "MAGASIN";

function canonMode(m) {
  if (!m) return null;
  const s = String(m).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (s.includes("cb") || s.includes("carte")) return "CB";
  if (s.startsWith("esp")) return "Especes";
  if (s.startsWith("cheq")) return "Cheque";
  if (s.startsWith("vir")) return "Virement";
  if (s.includes("offert") || s.includes("gratuit")) return "Offert";
  return m;
}

/**
 * Gain cordeur magasin (EUR) pour une ligne "suivi"
 * Règles prioritaires (exceptions) :
 * - si règlement Offert => 5€
 * - si fourni & tarif=12 => 5€
 * - si bobine base & tarif=12 => 5€
 * - si bobine spécifique & tarif=14 => 5,80€
 * Sinon: table cordages.gain_magasin_cents (ou POSE via tarif)
 */
function gainMagasinEurForSuiviRow(r, mapCordageGainMagasin) {
  const modeCanon = canonMode(r.reglement_mode);
  if (modeCanon === "Offert") return 5.0;

  const tarif = parseMoney(r.tarif);

  // Exceptions (prioritaires)
  if (r.fourni && Math.abs(tarif - 12) < 0.01) return 5.0;
  if (r.bobine_used === "base" && Math.abs(tarif - 12) < 0.01) return 5.0;
  if (r.bobine_used === "specific" && Math.abs(tarif - 14) < 0.01) return 5.8;

  // POSE (si tu veux garder le comportement spécial)
  const cordCanon = canon(r.cordage_id);
  if (cordCanon.includes("POSE")) {
    if (Math.abs(tarif - 14) < 0.01) return 5.83;
    if (Math.abs(tarif - 12) < 0.01) return 5.0;
    return DEFAULT_GAIN_EUR;
  }

  // Table gain_magasin_cents
  const key = cordageKey(r.cordage_id);
  return mapCordageGainMagasin.get(key) ?? DEFAULT_GAIN_EUR;
}

function marginForCordageRow(c) {
  const cents = c.gain_cents;

  if (cents != null) return Number(cents) / 100;
  const eur = c.marge_eur;

  if (eur != null) return Number(eur);

  return null;
}

function canonCordageLabel(label) {
  return norm(String(label || ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** ===== Page ===== */
export default function Stats(){
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]); // suivi (toute la saison)
  const [cordeurs, setCordeurs] = useState([]); // map id -> nom
  const [clubs, setClubs] = useState([]);       // map id -> libellé
  const [cordages, setCordages] = useState([]); // map id -> libellé
  const [tournoiRows, setTournoiRows] = useState([]); // raquettes des tournois (saison)
  const [tournois, setTournois] = useState([]);       // liste tournois (meta)
  const [tarifMatrix, setTarifMatrix] = useState([]); // tarif_matrix (pour calcul CA tournois)
  const [openTournois, setOpenTournois] = useState(() => new Set());
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [showAllTournois, setShowAllTournois] = useState(false);

  const { start, end, startISO, endISO } = useMemo(()=>getSeasonBounds(new Date()),[]);
  const { startISO: monthStartISO, endISO: monthEndISO } = useMemo(()=>getMonthBounds(new Date()),[]);

  const mapTournoiStart = useMemo(() => {
  const m = new Map();
  (tournois || []).forEach((t) => {
    const d = t.start_date || t.end_date || null;
    m.set(t.tournoi, d);
  });
  return m;
}, [tournois]);

  // ===== Load =====
  useEffect(()=>{
    (async ()=>{
      setLoading(true); setErr("");
      try{
        // suivi de la saison (on trie, on garde tout, on filtrera en mémoire)
        const qSuivi = supabase.from("suivi")
          .select("*")
          .gte("date", startISO).lte("date", endISO)
          .order("date",{ascending:false}).order("id",{ascending:false});
        // lookups
        const qCordeur = supabase.from("cordeur").select("*");
        const qClubs   = supabase.from("clubs").select("*");
        const qCordage = supabase.from("cordages").select("*");

        // Tournois (pour stats stand)
        const qTournois = supabase
          .from("tournois")
          .select("tournoi, start_date, end_date")
          .order("start_date", { ascending: false });

        const qTournoiRaquettes = supabase
          .from("tournoi_raquettes")
          .select(`
            id, tournoi, date, statut_id,
            club_id, cordeur_id, cordage_id,
            offert, fourni,
            gain_cents,
            cordeur:cordeur(cordeur),
            cordage:cordages(cordage, is_base)
          `)
          .gte("date", startISO).lte("date", endISO)
          .order("date", { ascending: false })
          .order("id", { ascending: false });

        const qTarifMatrix = supabase.from("tarif_matrix").select("*");

        const [s, lc, lclubs, lcordages, tmeta, traq, tm] = await Promise.all([
          qSuivi, qCordeur, qClubs, qCordage, qTournois, qTournoiRaquettes, qTarifMatrix
        ]);

        const firstErr = [s, lc, lclubs, lcordages, tmeta, traq, tm].find(r => r.error)?.error;
        if (firstErr) throw firstErr;

        setRows(s.data || []);
        setCordeurs(lc.data || []);
        setClubs(lclubs.data || []);
        setCordages(lcordages.data || []);
        setTournois(tmeta.data || []);
        setTournoiRows(traq.data || []);
        setTarifMatrix(tm.data || []);

        // Ouvre par défaut le tournoi le plus récent (si on a la liste "tournois")
        const latest = (tmeta.data || [])[0]?.tournoi; // car tu fais order start_date desc
        if (latest) setOpenTournois(new Set([latest]));

      }catch(e){
        console.error(e); setErr(e.message||"Erreur inconnue");
      }finally{ setLoading(false); }
    })();
  },[startISO,endISO]);

  // ===== Lookups =====
  const mapCordeur = useMemo(()=>{
    const m=new Map(); cordeurs.forEach(c=>m.set(c.cordeur||c.id, c.cordeur||c.id)); return m;
  },[cordeurs]);
  const mapClub = useMemo(()=>{
    const m=new Map();
    // essaye différentes colonnes que tu as en base (club / nom / name)
    clubs.forEach(c=>{
  const label = c.clubs || c.club || c.nom || c.name || c.id;
  m.set(c.clubs || c.id || label, label);
});
    return m;
  },[clubs]);
  const mapCordage = useMemo(()=>{
    const m=new Map(); cordages.forEach(c=>m.set(c.cordage||c.id, c.cordage||c.id)); return m;
  },[cordages]);

  const mapCordageGain = useMemo(() => {
  const m = new Map();
  (cordages || []).forEach((c) => {
    const key = cordageKey(c.cordage); // ✅ ICI
    const eur = (c.gain_cents != null) ? (Number(c.gain_cents) / 100) : null;
    if (key && eur != null) m.set(key, eur); // ✅ ne stocke pas de null
  });
  return m;
}, [cordages]);
const mapCordageMargin = useMemo(() => {
  const m = new Map();
  (cordages || []).forEach((c) => {
    const key = cordageKey(c.cordage);
    const eur = marginForCordageRow(c);
    if (key && eur != null) m.set(key, eur);
  });
  return m;
}, [cordages]);

const mapCordageGainMagasin = useMemo(() => {
  const m = new Map();
  (cordages || []).forEach((c) => {
    const key = cordageKey(c.cordage);
    const eur = (c.gain_magasin_cents != null) ? (Number(c.gain_magasin_cents) / 100) : null;
    if (key && eur != null) m.set(key, eur);
  });
  return m;
}, [cordages]);

  // ===== TOURNOIS (Stand) — tarif par ligne (mêmes règles que l’écran Tournoi) =====
  const priceForTournoiRow = (r) => {
    if (r?.offert) return 0;
    if (r?.fourni) return 12;

    // clubs: club_id correspond à clubs.clubs
    const club = (clubs || []).find((c) => c.id === r.club_id || c.clubs === r.club_id);
    const isBase = r?.cordage?.is_base; // vient du join cordage:cordages(...)
    if (!club || typeof isBase !== "boolean") return 0;

    const tm = (tarifMatrix || []).find(
      (row) =>
        (!!row.bobine_base) === !!club.bobine_base &&
        (!!row.bobine_specific) === !!club.bobine_specific &&
        (!!row.is_base) === !!isBase
    );
    return tm ? (tm.price_cents || 0) / 100 : 0;
  };

  // Lignes "faites" en tournoi (≠ A FAIRE)
  const tournoiDone = useMemo(
    () => (tournoiRows || []).filter((r) => isDone(r.statut_id)),
    [tournoiRows]
  );

  const seasonDone = useMemo(()=> rows.filter(r=>isDone(r.statut_id)), [rows]);
  const totalDone = seasonDone.length;
  const totalTournois = tournoiDone.length;

    // Empreintes des raquettes faites en tournoi (pour reconnaître celles exportées dans le suivi)
  const tournoiFingerprintSet = useMemo(() => {
    const set = new Set();

    for (const r of (tournoiDone || [])) {
      const d = r?.date ? new Date(r.date).toISOString().slice(0, 10) : "no-date";
      const key = [
        d,
        r?.club_id || "",
        r?.cordage_id || r?.cordage?.cordage || "",
        r?.cordeur_id || r?.cordeur?.cordeur || "",
        r?.fourni ? "1" : "0",
        r?.offert ? "1" : "0",
      ].join("|");
      set.add(key);
    }

    return set;
  }, [tournoiDone]);

   const seasonDoneMagasin = useMemo(() => {
    return seasonDone.filter((r) => {
      // doit être "magasin"
      if (!isMagasin(r.lieu_id)) return false;

      // empreinte du suivi (même format que tournoi)
      const d = r?.date ? new Date(r.date).toISOString().slice(0, 10) : "no-date";
      const key = [
        d,
        r?.club_id || "",
        r?.cordage_id || "",
        r?.cordeur_id || "",
        r?.fourni ? "1" : "0",
        r?.offert ? "1" : "0",
      ].join("|");

      // si cette raquette existe en tournoi, alors c’est une export => on l’exclut du magasin
      if (tournoiFingerprintSet.has(key)) return false;

      return true;
    });
  }, [seasonDone, tournoiFingerprintSet]);

  // Stats par tournoi (tableau principal demandé)
 const tournoiStats = useMemo(() => {
  const byTournoi = new Map();

  for (const r of tournoiDone) {
    const tName = r.tournoi || "—";
    const entry =
      byTournoi.get(tName) || {
        tournoi: tName,
        clubs: new Map(),
        totalCount: 0,
        ca: 0,
        cordeur: 0,
      };

    const clubLabel = mapClub.get(r.club_id) || r.club_id || "—";
    entry.clubs.set(clubLabel, (entry.clubs.get(clubLabel) || 0) + 1);
    entry.totalCount += 1;

    const price = priceForTournoiRow(r);
    entry.ca += price;

    const fallback =
      mapCordageGain.get(cordageKey(r.cordage_id || r?.cordage?.cordage)) ??
      DEFAULT_GAIN_EUR;

    const tarif = priceForTournoiRow(r);

    const cordeurEur = computeGainCordeur({
      offert: r.offert,
      fourni: r.fourni,
      tarifEur: tarif,
      gainCentsSnapshot: r.gain_cents,
      gainFromCordageEur: fallback,
    });

    entry.cordeur += cordeurEur;

    byTournoi.set(tName, entry);
  }

  const arr = Array.from(byTournoi.values()).map((t) => {
    const clubsArr = Array.from(t.clubs.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([club, n]) => ({ club, n }));

    return {
      tournoi: t.tournoi,
      start_date: mapTournoiStart.get(t.tournoi) || null,
      clubsArr,
      totalCount: t.totalCount,
      ca: t.ca,
      cordeur: t.cordeur,
    };
  });

  // ✅ tri par date (récent -> ancien)
  arr.sort((a, b) => {
    const da = a.start_date ? new Date(a.start_date).getTime() : 0;
    const db = b.start_date ? new Date(b.start_date).getTime() : 0;
    return db - da;
  });

  return arr;
}, [tournoiDone, mapClub, mapCordageGain, clubs, tarifMatrix, mapTournoiStart]);

const tournoiStatsToShow = showAllTournois ? tournoiStats : tournoiStats.slice(0, 5);

  // Totaux stand par mois (pour le tableau "Magasin / Tournois / Total")
  const tournoiByMonth = useMemo(() => {
    const m = new Map(); // mk -> { ca, cordeur, magasin, count }
    for (const r of tournoiDone) {
      const mk = monthKey(new Date(r.date));
      const cur = m.get(mk) || { ca: 0, cordeur: 0, magasin: 0, count: 0 };

      const ca = priceForTournoiRow(r);

      const fallback = mapCordageGain.get(cordageKey(r.cordage_id || r?.cordage?.cordage)) ?? DEFAULT_GAIN_EUR;
      const tarif = priceForTournoiRow(r);

      const cordeurEur = computeGainCordeur({
        offert: r.offert,
        fourni: r.fourni,
        tarifEur: tarif,
        gainCentsSnapshot: r.gain_cents,
        gainFromCordageEur: fallback,
      });

      cur.ca += ca;
      cur.cordeur += cordeurEur;
      cur.magasin += (ca - cordeurEur);
      cur.count += 1;

      m.set(mk, cur);
    }
    return m;
  }, [tournoiDone, mapCordageGain, clubs, tarifMatrix]);

  const margeVsTournoiByMonth = useMemo(() => {
  const m = new Map(); // mk -> { magasinTotal, magasinItems, tournoiTotal, tournoiItems }

  const addItem = (mk, type, cordageLabel, count, rateEur) => {
    const cur = m.get(mk) || {
  magasinTotal: 0,
  magasinItems: new Map(), // cordage -> {count, rate, total}

  payoutTotal: 0,
  payoutByCordeur: new Map(), // cordeur -> Map(cordage -> {count, rate, total})

  tournoiTotal: 0,
  tournoiItems: new Map(),
};

    const bucket = type === "magasin" ? cur.magasinItems : cur.tournoiItems;

    const prev = bucket.get(cordageLabel) || { count: 0, rate: rateEur, total: 0 };
    prev.count += count;
    prev.rate = rateEur; // on écrase (au cas où)
    prev.total += count * rateEur;
    bucket.set(cordageLabel, prev);

    if (type === "magasin") cur.magasinTotal += count * rateEur;
    else cur.tournoiTotal += count * rateEur;

    m.set(mk, cur);
  };

  // ---- MAGASIN : on utilise seasonDoneMagasin (anti export)
  for (const r of (seasonDoneMagasin || [])) {
    const mk = monthKey(new Date(r.date));
    const key = cordageKey(mapCordage.get(r.cordage_id) || r.cordage_id || "");
    const label = mapCordage.get(r.cordage_id) || r.cordage_id || "—";

    const rate = mapCordageMargin.get(key);
    if (rate == null) continue; // si pas de marge connue, on ignore

    addItem(mk, "magasin", label, 1, rate);
    // ---- PART CORDEURS MAGASIN (uniquement si cordeur éligible)
const cordeurName = mapCordeur.get(r.cordeur_id) || r.cordeur_id || "—";
if (CORDEURS_MAGASIN.has(cordeurName)) {
  const payRate = gainMagasinEurForSuiviRow(r, mapCordageGainMagasin);
if (payRate != null) {
    const cur = m.get(mk); // existe déjà car addItem a fait m.set(mk, cur)

    cur.payoutTotal += payRate;

    const perCordeur = cur.payoutByCordeur.get(cordeurName) || new Map();
    const prev = perCordeur.get(label) || { count: 0, rate: payRate, total: 0 };

    prev.count += 1;
    prev.rate = payRate;
    prev.total += payRate;

    perCordeur.set(label, prev);
    cur.payoutByCordeur.set(cordeurName, perCordeur);

    m.set(mk, cur);
  }
}
  }

  // ---- TOURNOI : on veut la part cordeur (gain) par cordage
  for (const r of (tournoiDone || [])) {
    const mk = monthKey(new Date(r.date));
    const label = r?.cordage?.cordage || r.cordage_id || "—";
    const key = cordageKey(label);

    // priorité : gain_cents figé sur la ligne tournoi (le plus fiable)
   const tarif = priceForTournoiRow(r);

const rate = computeGainCordeur({
  fourni: r.fourni,
  tarifEur: tarif,
  gainCentsSnapshot: r.gain_cents,
  gainFromCordageEur: mapCordageGain.get(key),
});

    if (rate == null) continue;

    addItem(mk, "tournoi", label, 1, rate);
  }

  // transforme les Maps en arrays triées
  const out = new Map();
  for (const [mk, v] of m.entries()) {
    const toArr = (mp) =>
      Array.from(mp.entries())
        .map(([cordage, o]) => ({ cordage, ...o }))
        .sort((a, b) => b.total - a.total || b.count - a.count || a.cordage.localeCompare(b.cordage));

    const payoutCordeurArr = Array.from((v.payoutByCordeur || new Map()).entries())
  .map(([cordeur, mp]) => {
    const items = Array.from(mp.entries()).map(([cordage, o]) => ({ cordage, ...o }))
      .sort((a,b)=> b.total-a.total || b.count-a.count || a.cordage.localeCompare(b.cordage));
    const total = items.reduce((a,x)=>a+(x.total||0),0);
    return { cordeur, total, items };
  })
  .sort((a,b)=> b.total-a.total || a.cordeur.localeCompare(b.cordeur));

out.set(mk, {
  magasinTotal: v.magasinTotal,
  magasinItems: toArr(v.magasinItems),

  payoutTotal: v.payoutTotal || 0,
  payoutByCordeur: payoutCordeurArr,

  tournoiTotal: v.tournoiTotal,
  tournoiItems: toArr(v.tournoiItems),
});
  }

  return out;
}, [seasonDoneMagasin, tournoiDone, mapCordage, mapCordageMargin, mapCordageGain, mapCordageGainMagasin, mapCordeur]);

  // ===== Dérivés =====
 const monthDone = useMemo(() => {
  return rows.filter((r) => {
    if (!isDone(r.statut_id)) return false;
    const d = rowISODate(r.date);
    return d >= monthStartISO && d <= monthEndISO;
  });
}, [rows, monthStartISO, monthEndISO]);

  // Encadré 1 — total saison
  const totalSeasonCount = seasonDone.length;

  // Encadré 2 — ce mois : par cordage (Top 5 + total)
  const monthByCordage = useMemo(()=>{
    const m = new Map();
    for (const r of monthDone){
      const label = mapCordage.get(r.cordage_id) || r.cordage_id || "—";
      m.set(label, (m.get(label)||0)+1);
    }
    const arr = Array.from(m, ([k,v])=>({cordage:k, count:v}))
      .sort((a,b)=> b.count-a.count || a.cordage.localeCompare(b.cordage));
    return { total: monthDone.length, items: arr.slice(0,5) };
  },[monthDone, mapCordage]);

  // Encadré 3 — saison : par cordeur (Top 5)
  const seasonByCordeur = useMemo(()=>{
    const m = new Map();
    for (const r of seasonDone){
      const name = mapCordeur.get(r.cordeur_id) || r.cordeur_id || "—";
      m.set(name, (m.get(name)||0)+1);
    }
    return Array.from(m, ([k,v])=>({cordeur:k, count:v}))
      .sort((a,b)=> b.count-a.count || a.cordeur.localeCompare(b.cordeur))
      .slice(0,5);
  },[seasonDone, mapCordeur]);

  // Tableau — par club (count + € sur la saison)
  const byClub = useMemo(()=>{
    const m = new Map();
    for (const r of seasonDone){
      const clubLabel = mapClub.get(r.club_id) || r.club_id || (r.lieu_id || "—");
      const x = m.get(clubLabel) || { club: clubLabel, count:0, euros:0 };
      x.count += 1;
      x.euros += parseMoney(r.tarif);
      m.set(clubLabel, x);
    }
    return Array.from(m.values()).sort((a,b)=> b.euros-a.euros || b.count-a.count || a.club.localeCompare(b.club));
  },[seasonDone, mapClub]);

  const byClubToShow = showAllClubs ? byClub : byClub.slice(0, 5);

  // Encadré — rémunération magasin par mois (6€/raquette, cordeurs autorisés)
const remunByMonthCordeur = useMemo(() => {
  // mois de la saison, dans l'ordre
  const months = [];
  const cur = new Date(start);
  while (cur <= end) {
    months.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  const table = {};
  for (const mk of months) table[mk] = {};

  for (const r of seasonDone) {
    if (!isMagasin(r.lieu_id)) continue;

    const name = mapCordeur.get(r.cordeur_id) || r.cordeur_id || "—";
    if (!CORDEURS_MAGASIN.has(name)) continue;

    const mk = monthKey(new Date(r.date));

    const gain = gainMagasinEurForSuiviRow(r, mapCordageGainMagasin);
    table[mk][name] = (table[mk][name] || 0) + gain;

  }

  return { months, table };
}, [seasonDone, start, end, mapCordeur, mapCordageGainMagasin]);

const remunMonthsToShow = useMemo(() => {
  const months = remunByMonthCordeur.months || [];
  const table = remunByMonthCordeur.table || {};

  return months.filter((mk) => {
    const row = table[mk] || {};
    const total = Object.values(row).reduce((a, x) => a + (Number(x) || 0), 0);
    return total > 0.0001; // garde uniquement les mois avec du montant
  });
}, [remunByMonthCordeur]);

  // Tableau — gains (€) par mois (évolution) + total saison
  const revenueByMonth = useMemo(()=>{
    const months = [];
    const cur = new Date(start);
    while (cur <= end){
      months.push(monthKey(cur));
      cur.setMonth(cur.getMonth()+1);
    }
    const m = new Map(months.map(mk=>[mk,0]));
    for (const r of seasonDone){
      const mk = monthKey(new Date(r.date));
      m.set(mk, (m.get(mk)||0) + parseMoney(r.tarif));
    }
    const rows = months.map(mk=>({ month: mk, euros: m.get(mk)||0 }));
    const seasonTotal = rows.reduce((a,x)=>a+x.euros,0);
    return { rows, seasonTotal };
  },[seasonDone, start, end]);

    const revenueMagasinByMonth = useMemo(() => {
    const m = new Map(); // mk -> euros
    for (const r of seasonDoneMagasin) {
      const mk = monthKey(new Date(r.date));
      const cur = m.get(mk) || 0;
      m.set(mk, cur + parseMoney(r.tarif));
    }
    return m;
  }, [seasonDoneMagasin]);

  const totalMagasin = seasonDoneMagasin.length;

  const monthsComparatifToShow = useMemo(() => {
  const eps = 0.0001;

  return (revenueByMonth.rows || []).filter((r) => {
    const calc = margeVsTournoiByMonth.get(r.month);
    if (!calc) return false;

    const brutMagasin = calc.magasinTotal || 0;
    const payout = calc.payoutTotal || 0;
    const tournoi = calc.tournoiTotal || 0;

    // On garde uniquement si un des 3 a une valeur
    return Math.abs(brutMagasin) > eps || Math.abs(payout) > eps || Math.abs(tournoi) > eps;
  });
}, [revenueByMonth.rows, margeVsTournoiByMonth]);

  return (
    <div className="min-h-screen bg-brand-gray py-8 px-4">
      <div className="w-[92vw] max-w-[1400px] mx-auto">
      </div>

      {/* Titre page (même style que Clubs/Clients) */}
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <img src={logo} alt="" className="h-8 w-8 rounded-full select-none" />
        <span>Statistiques</span>
      </h1>

      <div className="section-bar">Synthèse</div>


      {loading && <div className="mt-3 text-sm text-gray-600">Chargement…</div>}
      {err && <div className="mt-3 text-sm text-red-700">Erreur : {err}</div>}


      {/* --- Héro cards --- */}
      <div className="mt-4 grid md:grid-cols-3 gap-3">
        
        {/* 1) Saison : total */}
      <div className="card">
  <div className="text-sm text-gray-600 mb-2">
    🎾 Total cordées (saison)
  </div>

  <div className="text-4xl font-extrabold mb-3">
    {totalDone}
  </div>

  <div className="text-sm text-gray-700 space-y-1">
    <div className="flex justify-between">
      <span>Magasin</span>
      <b>{totalMagasin}</b>
    </div>
    <div className="flex justify-between">
      <span>Tournois</span>
      <b>{totalTournois}</b>
    </div>
  </div>
</div>

        {/* 2) Mois : par cordage */}
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <span className="inline-block" aria-hidden>📦</span>
            Ce mois • par cordage
          </div>
          <div className="mt-1 text-2xl font-bold">{monthByCordage.total}</div>
          <ul className="mt-2 text-sm space-y-1">
            {monthByCordage.items.map(it=>(
              <li key={it.cordage} className="flex justify-between">
                <span className="truncate">{it.cordage}</span>
                <b>{it.count}</b>
              </li>
            ))}
            {monthByCordage.items.length===0 && <li className="text-gray-500">—</li>}
          </ul>
        </div>

        {/* 3) Saison : par cordeur */}
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <span className="inline-block" aria-hidden>🧑‍🔧</span>
            Par cordeur (saison)
          </div>
          <ul className="mt-2 text-sm space-y-1">
            {seasonByCordeur.map(it=>(
              <li key={it.cordeur} className="flex justify-between">
                <span className="truncate">{it.cordeur}</span>
                <b>{it.count}</b>
              </li>
            ))}
            {seasonByCordeur.length===0 && <li className="text-gray-500">—</li>}
          </ul>
        </div>
      </div>

      <div className="section-bar mt-6">Par club (saison)</div>

      {/* --- Tableau par club --- */}
      <div className="mt-6 card">
        <div className="text-sm text-gray-600 mb-2">Par club (saison)</div>
        <div className="overflow-auto">
        {byClub.length > 5 && (
  <div className="mt-3 flex justify-center">
    <button
      type="button"
      className="px-4 h-10 rounded-xl border hover:bg-gray-50"
      onClick={() => setShowAllClubs((v) => !v)}
    >
      {showAllClubs ? "Réduire" : `Afficher tout (${byClub.length})`}
    </button>
  </div>
)}
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Club</th>
                <th className="py-2 pr-4">Raquettes</th>
                <th className="py-2 pr-4">Gain (€)</th>
              </tr>
            </thead>
            <tbody>
              {byClubToShow.map((r)=>(
                <tr key={r.club} className="border-b last:border-0">
                  <td className="py-2 pr-4">{r.club}</td>
                  <td className="py-2 pr-4 font-medium">{r.count}</td>
                  <td className="py-2 pr-4 font-semibold text-[#E10600]">{euro(r.euros)}</td>
                </tr>
              ))}
              {byClub.length===0 && (
                <tr><td colSpan={3} className="py-3 text-gray-500">—</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <MonthlyRevenueChart monthsBack={13} />
      </div>

            <div className="section-bar mt-6">Tournois (Stand) — détail</div>

      <div className="mt-6 card">
        <div className="text-sm text-gray-600 mb-2">
          Raquettes par tournoi • clubs • CA • part cordeur • gain magasin
        </div>  
  {tournoiStats.length > 5 && (
    <div className="mt-3 flex justify-center">
      <button
        type="button"
        className="px-4 h-10 rounded-xl border hover:bg-gray-50"
        onClick={() => setShowAllTournois(v => !v)}
      >
        {showAllTournois ? "Réduire" : `Afficher tout (${tournoiStats.length})`}
      </button>
    </div>
  )}
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Tournoi</th>
                <th className="py-2 pr-4">Clubs (nb)</th>
                <th className="py-2 pr-4">Raquettes</th>
                <th className="py-2 pr-4">CA (€)</th>
                <th className="py-2 pr-4">Part cordeur (€)</th>
              </tr>
            </thead>
            <tbody>
  {tournoiStatsToShow.map((t) => {
    const isOpen = openTournois.has(t.tournoi);

    return (
      <>
        {/* Ligne résumé */}
        <tr key={t.tournoi} className="border-b align-top">
          <td className="py-2 pr-4 font-medium">
            <button
              type="button"
              className="underline"
              onClick={() => {
                setOpenTournois((prev) => {
                  const next = new Set(prev);
                  if (next.has(t.tournoi)) next.delete(t.tournoi);
                  else next.add(t.tournoi);
                  return next;
                });
              }}
              title={isOpen ? "Réduire" : "Ouvrir"}
            >
              {isOpen ? "− " : "+ "}
              {t.tournoi}
            </button>
          </td>

          <td className="py-2 pr-4 text-gray-500">
            {isOpen ? "—" : `${t.clubsArr.length} clubs`}
          </td>

          <td className="py-2 pr-4 font-semibold">{t.totalCount}</td>
          <td className="py-2 pr-4 font-semibold text-[#E10600]">{euro(t.ca)}</td>
          <td className="py-2 pr-4 font-semibold">{euro(t.cordeur)}</td>
        </tr>

        {/* Ligne détails */}
        {isOpen && (
          <tr className="border-b bg-gray-50">
            <td className="py-2 pr-4" colSpan={5}>
              {t.clubsArr.length ? (
                <div className="space-y-1 max-w-[520px]">
                  {t.clubsArr.map((c) => (
                    <div key={c.club} className="flex justify-between gap-3">
                      <span className="truncate">{c.club}</span>
                      <b>{c.n}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </td>
          </tr>
        )}
      </>
    );
  })}

  {tournoiStats.length === 0 && (
    <tr>
      <td colSpan={5} className="py-3 text-gray-500">—</td>
    </tr>
  )}

  {tournoiStats.length > 0 && (() => {
    const totCount = tournoiStats.reduce((a,x)=>a+(x.totalCount||0),0);
    const totCA = tournoiStats.reduce((a,x)=>a+(x.ca||0),0);
    const totCordeur = tournoiStats.reduce((a,x)=>a+(x.cordeur||0),0);
    return (
      <tr className="border-t">
        <td className="py-2 pr-4 font-semibold">TOTAL</td>
        <td className="py-2 pr-4 text-gray-500">—</td>
        <td className="py-2 pr-4 font-extrabold">{totCount}</td>
        <td className="py-2 pr-4 font-extrabold">{euro(totCA)}</td>
        <td className="py-2 pr-4 font-extrabold">{euro(totCordeur)}</td>
      </tr>
    );
  })()}
</tbody>
          </table>
        </div>
      </div>

      <div className="section-bar mt-6">Rémunération cordeurs</div>

      {/* --- Rémunération cordeurs (Magasin, 6€/raq.) --- */}
      <div className="mt-6 card">
        <div className="text-sm text-gray-600 mb-2">
          Cordeurs (Magasin) • rémunération par mois (selon cordage)
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Mois</th>
                {[...CORDEURS_MAGASIN].map(name=>(
                  <th key={name} className="py-2 pr-4">{name}</th>
                ))}
                <th className="py-2 pr-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {remunMonthsToShow.map(mk => {
                const row = remunByMonthCordeur.table[mk] || {};
                const total = Object.values(row).reduce((a,x)=>a+(x||0),0);
                return (
                  <tr key={mk} className="border-b last:border-0">
                    <td className="py-2 pr-4">{monthLabel(mk)}</td>
                    {[...CORDEURS_MAGASIN].map(name=>(
                      <td key={name} className="py-2 pr-4">
                        {row[name] ? euro(row[name]) : "—"}
                      </td>
                    ))}
                    <td className="py-2 pr-2 font-semibold">{euro(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

            <div className="section-bar mt-6">Magasin vs Tournois (par mois)</div>

      <div className="mt-6 card">
        <div className="text-sm text-gray-600 mb-2">
          Comparatif mensuel • Magasin (suivi) + Tournois (stand) + Total
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Mois</th>
                <th className="py-2 pr-4">Marge Magasin (€)</th>
                <th className="py-2 pr-4">Part cordeurs (€)</th>
                <th className="py-2 pr-4">Gain Tournoi (€)</th>
                <th className="py-2 pr-2">Total (€)</th>
              </tr>
            </thead>
            <tbody>
              {monthsComparatifToShow.map((r) => {
               const calc = margeVsTournoiByMonth.get(r.month) || {
  magasinTotal: 0, magasinItems: [],
  tournoiTotal: 0, tournoiItems: [],
};
const payout = calc.payoutTotal || 0;
const brutMagasin = calc.magasinTotal || 0;     // <- BRUT
const netMagasin = brutMagasin - payout;        // <- NET (juste pour le total)
const tournoi = calc.tournoiTotal || 0;
const total = netMagasin + tournoi;

                return (
                  <tr key={r.month} className="border-b last:border-0">
                    <td className="py-2 pr-4">{monthLabel(r.month)}</td>
                    <td className="py-2 pr-4 font-semibold">
  <details>
<summary className="cursor-pointer underline select-none list-none">
      {euro(brutMagasin)}
    </summary>

    <div className="mt-2 space-y-1">
      {calc.magasinItems?.length ? (
        calc.magasinItems.map((it) => (
          <div key={it.cordage} className="flex justify-between gap-3">
            <span className="truncate max-w-[280px]">{it.cordage}</span>
            <span className="text-gray-600">
              {it.count} × {it.rate.toFixed(2)}€
            </span>
            <b>{euro(it.total)}</b>
          </div>
        ))
      ) : (
        <div className="text-gray-500">—</div>
      )}
    </div>
  </details>
</td>

<td className="py-2 pr-4 font-semibold">
  <details>
    <summary className="cursor-pointer underline select-none list-none">
  {euro(payout)}
</summary>

    <div className="mt-2 space-y-2">
      {calc.payoutByCordeur?.length ? (
        calc.payoutByCordeur.map((c) => (
          <details key={c.cordeur} className="ml-2">
<summary className="cursor-pointer underline select-none list-none">
              <b>{c.cordeur}</b> — {euro(c.total)}
            </summary>

            <div className="mt-1 space-y-1 ml-4">
              {c.items.map((it) => (
                <div key={it.cordage} className="flex justify-between gap-3">
                  <span className="truncate max-w-[280px]">{it.cordage}</span>
                  <span className="text-gray-600">
                    {it.count} × {it.rate.toFixed(2)}€
                  </span>
                  <b>{euro(it.total)}</b>
                </div>
              ))}
            </div>
          </details>
        ))
      ) : (
        <div className="text-gray-500">—</div>
      )}
    </div>
  </details>
</td>

<td className="py-2 pr-4 font-semibold">
  <details>
<summary className="cursor-pointer underline select-none list-none">
      {euro(tournoi)}
    </summary>

    <div className="mt-2 space-y-1">
      {calc.tournoiItems?.length ? (
        calc.tournoiItems.map((it) => (
          <div key={it.cordage} className="flex justify-between gap-3">
            <span className="truncate max-w-[280px]">{it.cordage}</span>
            <span className="text-gray-600">
              {it.count} × {it.rate.toFixed(2)}€
            </span>
            <b>{euro(it.total)}</b>
          </div>
        ))
      ) : (
        <div className="text-gray-500">—</div>
      )}
    </div>
  </details>
</td>
                    <td className="py-2 pr-2 font-extrabold">
  {euro(total)}
  <div className="text-xs text-gray-500 font-normal">
    ({euro(brutMagasin)} − {euro(payout)} + {euro(tournoi)})
  </div>
</td>

                  </tr>
                );
              })}
<tr className="border-t">
  {(() => {
    const seasonMagasin = revenueByMonth.rows.reduce(
      (a, x) => a + (margeVsTournoiByMonth.get(x.month)?.magasinTotal || 0),
      0
    );
    const seasonPayout = revenueByMonth.rows.reduce(
      (a, x) => a + (margeVsTournoiByMonth.get(x.month)?.payoutTotal || 0),
      0
    );
    const seasonTournoi = revenueByMonth.rows.reduce(
      (a, x) => a + (margeVsTournoiByMonth.get(x.month)?.tournoiTotal || 0),
      0
    );

    const seasonTotal = (seasonMagasin - seasonPayout) + seasonTournoi;

    return (
      <>
        <td className="py-2 pr-4 font-semibold">Total saison</td>
        <td className="py-2 pr-4 font-extrabold">{euro(seasonMagasin)}</td>
        <td className="py-2 pr-4 font-extrabold">{euro(seasonPayout)}</td>
        <td className="py-2 pr-4 font-extrabold">{euro(seasonTournoi)}</td>
        <td className="py-2 pr-2 font-extrabold">
          {euro(seasonTotal)}
          <div className="text-xs text-gray-500 font-normal">
            ({euro(seasonMagasin)} − {euro(seasonPayout)} + {euro(seasonTournoi)})
          </div>
        </td>
      </>
    );
  })()}
</tr>

            </tbody>
          </table>
        </div>
      </div>

      {/* petites marges de fin */}
      <div className="h-4" />
    </div>
  );
}