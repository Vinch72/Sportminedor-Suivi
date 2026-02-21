import { useEffect, useMemo, useState, Fragment } from "react";
import { supabase } from "../utils/supabaseClient";
import logo from "../assets/sportminedor-logo.png";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell as PieCell,
} from "recharts";
import MonthlyRevenueChart from "../components/stats/MonthlyRevenueChart.jsx";
import { computeGainCordeur } from "../utils/computeGainCordeur";

/* ─────────────────────────────────────────────
   HELPERS (identiques à Stats.jsx original)
───────────────────────────────────────────── */
const FR_MONTHS = ["Janv.","Fév.","Mars","Avr.","Mai","Juin","Juil.","Août","Sept.","Oct.","Nov.","Déc."];
const DONUT_COLORS = ["#E10600","#c40500","#ff4040","#ff7070","#ffaaaa","#ffd0d0","#aaa"];
const CORDEURS_MAGASIN = new Set(["Seul","Constant","Kellian","Vincenzo","Matéo","Mickaël"]);
const DEFAULT_GAIN_EUR = 6;

function pad2(n){ return String(n).padStart(2,"0"); }
function dateISO(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function monthKey(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; }
function monthLabel(ym){ const [y,m]=ym.split("-").map(Number); return `${FR_MONTHS[(m-1+12)%12]} ${y}`; }
function rowISODate(v){ if(!v) return ""; return String(v).slice(0,10); }

function getSeasonBounds(today=new Date()){
  const y=today.getFullYear(), m=today.getMonth();
  const startYear = m>=8 ? y : y-1;
  const start = new Date(startYear,8,1);
  const end = new Date(startYear+1,7,31,23,59,59,999);
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
const euro = (n)=> `${(Number(n)||0).toLocaleString("fr-FR",{minimumFractionDigits:0,maximumFractionDigits:2})} €`;
const parseMoney = (v)=>{ if(v==null) return 0; const s=String(v).replace(/\s/g,""); const m=s.match(/-?\d+(?:[.,]\d+)?/); return m?parseFloat(m[0].replace(",",".")):0; };
const canon = (s)=>(s||"").toString().normalize("NFD").replace(/\p{Diacritic}/gu,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const cordageKey = (s)=>{ const c=canon(s); if(c.includes("POSE")) return "POSE"; const m=c.match(/(BG80POWER|BG80|BG65|BG66|EXBOLT63|EXBOLT65|EXBOLT68|NANOGY95|NANOGY98|NANOGY99|AEROBITE|SKYARC)/); return m?m[1]:c; };
const isMagasin = (v)=> canon(v)==="MAGASIN";
function canonMode(m){ if(!m) return null; const s=String(m).normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase(); if(s.includes("cb")||s.includes("carte")) return "CB"; if(s.startsWith("esp")) return "Especes"; if(s.startsWith("cheq")) return "Cheque"; if(s.startsWith("vir")) return "Virement"; if(s.includes("offert")||s.includes("gratuit")) return "Offert"; return m; }
function gainMagasinEurForSuiviRow(r,mapCordageGainMagasin){ const modeCanon=canonMode(r.reglement_mode); if(modeCanon==="Offert") return 5.0; const tarif=parseMoney(r.tarif); if(r.fourni&&Math.abs(tarif-12)<0.01) return 5.0; if(r.bobine_used==="base"&&Math.abs(tarif-12)<0.01) return 5.0; if(r.bobine_used==="specific"&&Math.abs(tarif-14)<0.01) return 5.8; const cordCanon=canon(r.cordage_id); if(cordCanon.includes("POSE")){ if(Math.abs(tarif-14)<0.01) return 5.83; if(Math.abs(tarif-12)<0.01) return 5.0; return DEFAULT_GAIN_EUR; } const key=cordageKey(r.cordage_id); return mapCordageGainMagasin.get(key)??DEFAULT_GAIN_EUR; }
function marginForCordageRow(c){ const cents=c.gain_cents; if(cents!=null) return Number(cents)/100; const eur=c.marge_eur; if(eur!=null) return Number(eur); return null; }

/* ─────────────────────────────────────────────
   UI COMPONENTS
───────────────────────────────────────────── */

/** Carte KPI principale */
function KPICard({ icon, label, value, sub, children, accent = "#E10600" }) {
  return (
    <div style={{
      background: "white", borderRadius: 16, padding: "20px 24px",
      border: "1px solid #ebebeb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      display: "flex", flexDirection: "column", gap: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#aaa" }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 40, fontWeight: 900, color: "#111", letterSpacing: -2, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>{sub}</div>}
      {children && <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f5f5f5" }}>{children}</div>}
    </div>
  );
}

/** Barre de progression */
function MiniBar({ pct, color = "#E10600" }) {
  return (
    <div style={{ height: 4, borderRadius: 99, background: "#f0f0f0", overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", borderRadius: 99, background: color, width: `${Math.max(2, pct)}%`, transition: "width .4s" }} />
    </div>
  );
}

/** Ligne d'un tableau avec rank optionnel */
function TableRow({ rank, left, right, sub, pct, isTotal, isOdd }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <tr style={{ background: isTotal ? "#fafafa" : isOdd ? "#fdfdfd" : "white", borderBottom: "1px solid #f5f5f5" }}>
      {rank !== undefined && (
        <td style={{ padding: "11px 10px 11px 16px", width: 36, color: "#ccc", fontSize: 12, fontFamily: "monospace" }}>
          {medal || <span style={{ color: "#ddd" }}>{rank}</span>}
        </td>
      )}
      <td style={{ padding: "11px 12px", minWidth: 140 }}>
        <div style={{ fontWeight: isTotal ? 700 : 500, color: "#222", fontSize: 13 }}>{left}</div>
        {sub && <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{sub}</div>}
        {pct !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <MiniBar pct={pct} />
          </div>
        )}
      </td>
      {Array.isArray(right) ? right.map((v, i) => (
        <td key={i} style={{ padding: "11px 16px 11px 12px", textAlign: "right", fontSize: 13,
          fontWeight: isTotal ? 800 : 600, color: i === right.length - 1 ? "#E10600" : "#333", whiteSpace: "nowrap" }}>
          {v}
        </td>
      )) : (
        <td style={{ padding: "11px 16px 11px 12px", textAlign: "right", fontSize: 13,
          fontWeight: isTotal ? 800 : 600, color: "#E10600", whiteSpace: "nowrap" }}>
          {right}
        </td>
      )}
    </tr>
  );
}

/** En-tête de section */
function SectionHeader({ title, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "32px 0 14px" }}>
      <div style={{ width: 3, height: 18, background: "#E10600", borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 12, color: "#bbb", background: "#f5f5f5", borderRadius: 20,
          padding: "2px 10px", fontWeight: 500 }}>{count}</span>
      )}
      <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
    </div>
  );
}

/** Card générique */
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "white", borderRadius: 16, border: "1px solid #ebebeb",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", ...style,
    }}>
      {children}
    </div>
  );
}

/** Header de card */
function CardHeader({ title, right }) {
  return (
    <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#444" }}>{title}</span>
      {right && <span style={{ fontSize: 12, color: "#bbb" }}>{right}</span>}
    </div>
  );
}

/** Tableau stylé générique */
function StyledTable({ headers, children, minWidth = 720 }) {
  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth,              // important: évite que les colonnes s’écrasent
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
            {headers.map((h, i) => (
              <th
                key={`${h}-${i}`}
                style={{
                  padding: i === 0 ? "10px 12px 10px 16px" : "10px 16px 10px 12px",
                  textAlign: i === 0 ? "left" : "right",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: "#bbb",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE PRINCIPALE
───────────────────────────────────────────── */
export default function Stats() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [cordeurs, setCordeurs] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [cordages, setCordages] = useState([]);
  const [tournoiRows, setTournoiRows] = useState([]);
  const [tournois, setTournois] = useState([]);
  const [tarifMatrix, setTarifMatrix] = useState([]);
  const [openTournois, setOpenTournois] = useState(() => new Set());
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [showAllTournois, setShowAllTournois] = useState(false);

  const { start, end, startISO, endISO } = useMemo(() => getSeasonBounds(new Date()), []);
  const { startISO: monthStartISO, endISO: monthEndISO } = useMemo(() => getMonthBounds(new Date()), []);

  const mapTournoiStart = useMemo(() => {
    const m = new Map();
    (tournois || []).forEach(t => { const d = t.start_date || t.end_date || null; m.set(t.tournoi, d); });
    return m;
  }, [tournois]);

    const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 520 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 520);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr("");
      try {
        const [s, lc, lclubs, lcordages, tmeta, traq, tm] = await Promise.all([
          supabase.from("suivi").select("*").gte("date", startISO).lte("date", endISO).order("date",{ascending:false}).order("id",{ascending:false}),
          supabase.from("cordeur").select("*"),
          supabase.from("clubs").select("*"),
          supabase.from("cordages").select("*"),
          supabase.from("tournois").select("tournoi, start_date, end_date").order("start_date",{ascending:false}),
          supabase.from("tournoi_raquettes").select(`id, tournoi, date, statut_id, club_id, cordeur_id, cordage_id, offert, fourni, gain_cents, cordeur:cordeur(cordeur), cordage:cordages(cordage, is_base)`).gte("date",startISO).lte("date",endISO).order("date",{ascending:false}).order("id",{ascending:false}),
          supabase.from("tarif_matrix").select("*"),
        ]);
        const firstErr = [s,lc,lclubs,lcordages,tmeta,traq,tm].find(r=>r.error)?.error;
        if (firstErr) throw firstErr;
        setRows(s.data||[]); setCordeurs(lc.data||[]); setClubs(lclubs.data||[]); setCordages(lcordages.data||[]);
        setTournois(tmeta.data||[]); setTournoiRows(traq.data||[]); setTarifMatrix(tm.data||[]);
        const latest = (tmeta.data||[])[0]?.tournoi;
        if (latest) setOpenTournois(new Set([latest]));
      } catch(e) { console.error(e); setErr(e.message||"Erreur inconnue"); }
      finally { setLoading(false); }
    })();
  }, [startISO, endISO]);

  // Lookups
  const mapCordeur = useMemo(() => { const m=new Map(); cordeurs.forEach(c=>m.set(c.cordeur||c.id, c.cordeur||c.id)); return m; }, [cordeurs]);
  const mapClub = useMemo(() => { const m=new Map(); clubs.forEach(c=>{ const label=c.clubs||c.club||c.nom||c.name||c.id; m.set(c.clubs||c.id||label,label); }); return m; }, [clubs]);
  const mapCordage = useMemo(() => { const m=new Map(); cordages.forEach(c=>m.set(c.cordage||c.id,c.cordage||c.id)); return m; }, [cordages]);
  const mapCordageGain = useMemo(() => { const m=new Map(); (cordages||[]).forEach(c=>{ const key=cordageKey(c.cordage); const eur=(c.gain_cents!=null)?(Number(c.gain_cents)/100):null; if(key&&eur!=null) m.set(key,eur); }); return m; }, [cordages]);
  const mapCordageMargin = useMemo(() => { const m=new Map(); (cordages||[]).forEach(c=>{ const key=cordageKey(c.cordage); const eur=marginForCordageRow(c); if(key&&eur!=null) m.set(key,eur); }); return m; }, [cordages]);
  const mapCordageGainMagasin = useMemo(() => { const m=new Map(); (cordages||[]).forEach(c=>{ const key=cordageKey(c.cordage); const eur=(c.gain_magasin_cents!=null)?(Number(c.gain_magasin_cents)/100):null; if(key&&eur!=null) m.set(key,eur); }); return m; }, [cordages]);

  const priceForTournoiRow = (r) => {
    if (r?.offert) return 0; if (r?.fourni) return 12;
    const club=(clubs||[]).find(c=>c.id===r.club_id||c.clubs===r.club_id);
    const isBase=r?.cordage?.is_base;
    if (!club||typeof isBase!=="boolean") return 0;
    const tm=(tarifMatrix||[]).find(row=>(!!row.bobine_base)===!!club.bobine_base&&(!!row.bobine_specific)===!!club.bobine_specific&&(!!row.is_base)===!!isBase);
    return tm?(tm.price_cents||0)/100:0;
  };

  const tournoiDone = useMemo(() => (tournoiRows||[]).filter(r=>isDone(r.statut_id)), [tournoiRows]);
  const seasonDone = useMemo(() => rows.filter(r=>isDone(r.statut_id)), [rows]);
  const totalDone = seasonDone.length;
  const totalTournois = tournoiDone.length;

  const tournoiFingerprintSet = useMemo(() => {
    const set=new Set();
    for(const r of (tournoiDone||[])){ const d=r?.date?new Date(r.date).toISOString().slice(0,10):"no-date"; set.add([d,r?.club_id||"",r?.cordage_id||r?.cordage?.cordage||"",r?.cordeur_id||r?.cordeur?.cordeur||"",r?.fourni?"1":"0",r?.offert?"1":"0"].join("|")); }
    return set;
  }, [tournoiDone]);

  const seasonDoneMagasin = useMemo(() => {
    return seasonDone.filter(r=>{
      if(!isMagasin(r.lieu_id)) return false;
      const d=r?.date?new Date(r.date).toISOString().slice(0,10):"no-date";
      const key=[d,r?.club_id||"",r?.cordage_id||"",r?.cordeur_id||"",r?.fourni?"1":"0",r?.offert?"1":"0"].join("|");
      return !tournoiFingerprintSet.has(key);
    });
  }, [seasonDone, tournoiFingerprintSet]);

  const totalMagasin = seasonDoneMagasin.length;

  const monthDone = useMemo(() => rows.filter(r=>{ if(!isDone(r.statut_id)) return false; const d=rowISODate(r.date); return d>=monthStartISO&&d<=monthEndISO; }), [rows,monthStartISO,monthEndISO]);

  const monthByCordage = useMemo(() => {
    const m=new Map();
    for(const r of monthDone){ const label=mapCordage.get(r.cordage_id)||r.cordage_id||"—"; m.set(label,(m.get(label)||0)+1); }
    const arr=Array.from(m,([k,v])=>({cordage:k,count:v})).sort((a,b)=>b.count-a.count||a.cordage.localeCompare(b.cordage));
    return { total: monthDone.length, items: arr.slice(0,5) };
  }, [monthDone, mapCordage]);

  const seasonByCordeur = useMemo(() => {
    const m=new Map();
    for(const r of seasonDone){ const name=mapCordeur.get(r.cordeur_id)||r.cordeur_id||"—"; m.set(name,(m.get(name)||0)+1); }
    return Array.from(m,([k,v])=>({cordeur:k,count:v})).sort((a,b)=>b.count-a.count||a.cordeur.localeCompare(b.cordeur)).slice(0,5);
  }, [seasonDone, mapCordeur]);

  const byClub = useMemo(() => {
    const m=new Map();
    for(const r of seasonDone){ const clubLabel=mapClub.get(r.club_id)||r.club_id||(r.lieu_id||"—"); const x=m.get(clubLabel)||{club:clubLabel,count:0,euros:0}; x.count+=1; x.euros+=parseMoney(r.tarif); m.set(clubLabel,x); }
    return Array.from(m.values()).sort((a,b)=>b.euros-a.euros||b.count-a.count||a.club.localeCompare(b.club));
  }, [seasonDone, mapClub]);

  const byClubToShow = showAllClubs ? byClub : byClub.slice(0,5);

  const tournoiStats = useMemo(() => {
    const byTournoi=new Map();
    for(const r of tournoiDone){
      const tName=r.tournoi||"—";
      const entry=byTournoi.get(tName)||{tournoi:tName,clubs:new Map(),totalCount:0,ca:0,cordeur:0};
      const clubLabel=mapClub.get(r.club_id)||r.club_id||"—";
      entry.clubs.set(clubLabel,(entry.clubs.get(clubLabel)||0)+1);
      entry.totalCount+=1;
      const price=priceForTournoiRow(r); entry.ca+=price;
      const fallback=mapCordageGain.get(cordageKey(r.cordage_id||r?.cordage?.cordage))??DEFAULT_GAIN_EUR;
      entry.cordeur+=computeGainCordeur({offert:r.offert,fourni:r.fourni,tarifEur:price,gainCentsSnapshot:r.gain_cents,gainFromCordageEur:fallback});
      byTournoi.set(tName,entry);
    }
    const arr=Array.from(byTournoi.values()).map(t=>({
      tournoi:t.tournoi, start_date:mapTournoiStart.get(t.tournoi)||null,
      clubsArr:Array.from(t.clubs.entries()).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([club,n])=>({club,n})),
      totalCount:t.totalCount, ca:t.ca, cordeur:t.cordeur,
    }));
    arr.sort((a,b)=>{ const da=a.start_date?new Date(a.start_date).getTime():0; const db=b.start_date?new Date(b.start_date).getTime():0; return db-da; });
    return arr;
  }, [tournoiDone, mapClub, mapCordageGain, clubs, tarifMatrix, mapTournoiStart]);

  const tournoiStatsToShow = showAllTournois ? tournoiStats : tournoiStats.slice(0,5);

  const revenueByMonth = useMemo(() => {
    const months=[]; const cur=new Date(start);
    while(cur<=end){ months.push(monthKey(cur)); cur.setMonth(cur.getMonth()+1); }
    const m=new Map(months.map(mk=>[mk,0]));
    for(const r of seasonDone){ const mk=monthKey(new Date(r.date)); m.set(mk,(m.get(mk)||0)+parseMoney(r.tarif)); }
    const rows=months.map(mk=>({month:mk,euros:m.get(mk)||0}));
    return { rows, seasonTotal: rows.reduce((a,x)=>a+x.euros,0) };
  }, [seasonDone, start, end]);

  const countByMonth = useMemo(() => {
    const todayMk=monthKey(new Date());
    const months=revenueByMonth.rows.map(r=>r.month);
    const m=new Map(months.map(mk=>[mk,0]));
    for(const r of seasonDone){ const mk=monthKey(new Date(r.date)); if(m.has(mk)) m.set(mk,m.get(mk)+1); }
    return revenueByMonth.rows.filter(mk=>mk.month<=todayMk).map(mk=>({month:mk.month,count:m.get(mk.month)||0}));
  }, [revenueByMonth.rows, seasonDone]);

  const remunByMonthCordeur = useMemo(() => {
    const months=[]; const cur=new Date(start);
    while(cur<=end){ months.push(monthKey(cur)); cur.setMonth(cur.getMonth()+1); }
    const table={}; for(const mk of months) table[mk]={};
    for(const r of seasonDone){
      if(!isMagasin(r.lieu_id)) continue;
      const name=mapCordeur.get(r.cordeur_id)||r.cordeur_id||"—";
      if(!CORDEURS_MAGASIN.has(name)) continue;
      const mk=monthKey(new Date(r.date));
      table[mk][name]=(table[mk][name]||0)+gainMagasinEurForSuiviRow(r,mapCordageGainMagasin);
    }
    return { months, table };
  }, [seasonDone, start, end, mapCordeur, mapCordageGainMagasin]);

  const remunMonthsToShow = useMemo(() => {
    return (remunByMonthCordeur.months||[]).filter(mk=>{
      const row=remunByMonthCordeur.table[mk]||{};
      return Object.values(row).reduce((a,x)=>a+(Number(x)||0),0)>0.0001;
    });
  }, [remunByMonthCordeur]);

  const margeVsTournoiByMonth = useMemo(() => {
    const m=new Map();
    const addItem=(mk,type,cordageLabel,count,rateEur)=>{
      const cur=m.get(mk)||{magasinTotal:0,magasinItems:new Map(),payoutTotal:0,payoutByCordeur:new Map(),tournoiTotal:0,tournoiItems:new Map()};
      const bucket=type==="magasin"?cur.magasinItems:cur.tournoiItems;
      const prev=bucket.get(cordageLabel)||{count:0,rate:rateEur,total:0};
      prev.count+=count; prev.rate=rateEur; prev.total+=count*rateEur; bucket.set(cordageLabel,prev);
      if(type==="magasin") cur.magasinTotal+=count*rateEur; else cur.tournoiTotal+=count*rateEur;
      m.set(mk,cur);
    };
    for(const r of (seasonDoneMagasin||[])){
      const mk=monthKey(new Date(r.date));
      const key=cordageKey(mapCordage.get(r.cordage_id)||r.cordage_id||"");
      const label=mapCordage.get(r.cordage_id)||r.cordage_id||"—";
      const rate=mapCordageMargin.get(key); if(rate==null) continue;
      addItem(mk,"magasin",label,1,rate);
      const cordeurName=mapCordeur.get(r.cordeur_id)||r.cordeur_id||"—";
      if(CORDEURS_MAGASIN.has(cordeurName)){
        const payRate=gainMagasinEurForSuiviRow(r,mapCordageGainMagasin);
        if(payRate!=null){
          const cur=m.get(mk);
          cur.payoutTotal+=payRate;
          const perCordeur=cur.payoutByCordeur.get(cordeurName)||new Map();
          const prev=perCordeur.get(label)||{count:0,rate:payRate,total:0};
          prev.count+=1; prev.rate=payRate; prev.total+=payRate;
          perCordeur.set(label,prev); cur.payoutByCordeur.set(cordeurName,perCordeur); m.set(mk,cur);
        }
      }
    }
    for(const r of (tournoiDone||[])){
      const mk=monthKey(new Date(r.date));
      const label=r?.cordage?.cordage||r.cordage_id||"—";
      const key=cordageKey(label);
      const tarif=priceForTournoiRow(r);
      const rate=computeGainCordeur({fourni:r.fourni,tarifEur:tarif,gainCentsSnapshot:r.gain_cents,gainFromCordageEur:mapCordageGain.get(key)});
      if(rate==null) continue;
      addItem(mk,"tournoi",label,1,rate);
    }
    const out=new Map();
    for(const [mk,v] of m.entries()){
      const toArr=(mp)=>Array.from(mp.entries()).map(([cordage,o])=>({cordage,...o})).sort((a,b)=>b.total-a.total||b.count-a.count||a.cordage.localeCompare(b.cordage));
      const payoutCordeurArr=Array.from((v.payoutByCordeur||new Map()).entries()).map(([cordeur,mp])=>{
        const items=Array.from(mp.entries()).map(([cordage,o])=>({cordage,...o})).sort((a,b)=>b.total-a.total||b.count-a.count||a.cordage.localeCompare(b.cordage));
        return {cordeur,total:items.reduce((a,x)=>a+(x.total||0),0),items};
      }).sort((a,b)=>b.total-a.total||a.cordeur.localeCompare(b.cordeur));
      out.set(mk,{magasinTotal:v.magasinTotal,magasinItems:toArr(v.magasinItems),payoutTotal:v.payoutTotal||0,payoutByCordeur:payoutCordeurArr,tournoiTotal:v.tournoiTotal,tournoiItems:toArr(v.tournoiItems)});
    }
    return out;
  }, [seasonDoneMagasin, tournoiDone, mapCordage, mapCordageMargin, mapCordageGain, mapCordageGainMagasin, mapCordeur]);

  const monthsComparatifToShow = useMemo(() => {
    return (revenueByMonth.rows||[]).filter(r=>{
      const calc=margeVsTournoiByMonth.get(r.month); if(!calc) return false;
      return Math.abs(calc.magasinTotal||0)>0.0001||Math.abs(calc.payoutTotal||0)>0.0001||Math.abs(calc.tournoiTotal||0)>0.0001;
    });
  }, [revenueByMonth.rows, margeVsTournoiByMonth]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#111", color: "white", borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
        <b>{monthLabel(label)}</b><br />
        {payload[0].value} raquettes
      </div>
    );
  };

  /* ── RENDER ── */
  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f8", padding: "32px 24px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%" }}>

        {/* Titre */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <img src={logo} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#111" }}>Statistiques</h1>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#bbb" }}>
            Saison {new Date(startISO).getFullYear()}–{new Date(endISO).getFullYear()}
          </span>
        </div>

        {loading && <div style={{ color: "#999", fontSize: 14 }}>Chargement…</div>}
        {err && <div style={{ color: "#E10600", fontSize: 14 }}>Erreur : {err}</div>}

        {/* ── KPI CARDS ── */}
        <SectionHeader title="Synthèse" />
        <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  }}
>

          {/* Total saison */}
          <KPICard icon="🏸" label="Saison en cours" value={totalDone} sub="raquettes cordées">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#666", width: 72 }}>🏪 Magasin</span>
                <MiniBar pct={Math.round(totalMagasin/Math.max(totalDone,1)*100)} />
                <span style={{ fontSize: 12, fontWeight: 700, width: 32, textAlign: "right" }}>{totalMagasin}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#666", width: 72 }}>🏆 Tournois</span>
                <MiniBar pct={Math.round(totalTournois/Math.max(totalDone,1)*100)} color="#ffb3b3" />
                <span style={{ fontSize: 12, fontWeight: 700, width: 32, textAlign: "right" }}>{totalTournois}</span>
              </div>
            </div>
          </KPICard>

          {/* Ce mois */}
          <KPICard icon="📦" label="Ce mois • cordages" value={monthByCordage.total} sub="raquettes">
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {monthByCordage.items.map((it, i) => (
                <div key={it.cordage} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#666", width: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.cordage}</span>
                  <MiniBar pct={Math.round(it.count/Math.max(monthByCordage.total,1)*100)} />
                  <span style={{ fontSize: 12, fontWeight: 700, width: 28, textAlign: "right" }}>{it.count}</span>
                </div>
              ))}
            </div>
          </KPICard>

          {/* Cordeurs */}
          <KPICard icon="🧑‍🔧" label="Cordeurs • saison"
            value={seasonByCordeur[0]?.count ?? "—"}
            sub={`${seasonByCordeur[0]?.cordeur ?? ""} (top)`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {seasonByCordeur.map(it => (
                <div key={it.cordeur} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#666", width: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.cordeur}</span>
                  <MiniBar pct={Math.round(it.count/Math.max(seasonByCordeur[0]?.count??1,1)*100)} />
                  <span style={{ fontSize: 12, fontWeight: 700, width: 28, textAlign: "right" }}>{it.count}</span>
                </div>
              ))}
            </div>
          </KPICard>
        </div>

        {/* ── GRAPHIQUES ── */}
        <SectionHeader title="Activité" />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>

          {/* Bar chart raquettes/mois */}
          <Card>
            <CardHeader title="🎾 Raquettes cordées par mois" />
            <div style={{ padding: "0 16px 16px" }}>
              <ResponsiveContainer width="100%" height={isMobile ? 170 : 190}>
                <BarChart data={countByMonth} barSize={isMobile ? 14 : 20} margin={{ left: 0, right: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#bbb" }} axisLine={false} tickLine={false} tickFormatter={monthLabel} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f7f7f8" }} />
                  <Bar dataKey="count" fill="#E10600" radius={[5,5,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Donut cordages */}
          <Card>
            <CardHeader title="📦 Cordages ce mois" right={`${monthByCordage.total} raquettes`} />
<div
  style={{
    padding: isMobile ? "0 16px 16px" : "0 20px 20px",
    display: "flex",
    alignItems: "center",
    gap: isMobile ? 14 : 20,
    flexDirection: isMobile ? "column" : "row",
    overflow: "hidden",
    boxSizing: "border-box",
  }}
>
  {/* Donut */}
  <div
    style={{
      width: isMobile ? "100%" : 140,
      display: "flex",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <PieChart width={isMobile ? 130 : 120} height={isMobile ? 130 : 120}>
      <Pie
        data={monthByCordage.items}
        cx="50%"
        cy="50%"
        innerRadius={isMobile ? 42 : 38}
        outerRadius={isMobile ? 58 : 52}
        dataKey="count"
        paddingAngle={2}
      >
        {monthByCordage.items.map((_, i) => (
          <PieCell key={`slice-${i}`} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
        ))}
      </Pie>

      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: isMobile ? 18 : 17, fontWeight: 900, fill: "#111" }}
      >
        {monthByCordage.total}
      </text>
      <text
        x="50%"
        y="60%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: 9, fill: "#bbb" }}
      >
        raquettes
      </text>
    </PieChart>
  </div>

  {/* Liste */}
  <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
    {monthByCordage.items.map((it, i) => {
      const pct = Math.round((it.count / Math.max(monthByCordage.total, 1)) * 100);
      return (
        <div key={it.cordage} style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#555" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: DONUT_COLORS[i % DONUT_COLORS.length],
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={{ maxWidth: isMobile ? 180 : 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.cordage}
              </span>
            </span>

            <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              {it.count} <span style={{ color: "#bbb", fontWeight: 400 }}>({pct}%)</span>
            </span>
          </div>

          <MiniBar pct={pct} color={DONUT_COLORS[i % DONUT_COLORS.length]} />
        </div>
      );
    })}
  </div>
</div>
          </Card>
        </div>

        {/* Courbe revenus */}
        <div style={{ marginTop: 14 }}>
          <MonthlyRevenueChart monthsBack={13} />
        </div>

        {/* ── PAR CLUB ── */}
        <SectionHeader title="Par club (saison)" count={`${byClub.length} clubs`} />
        <Card>
          <StyledTable headers={["#", "Club", "Raquettes", "CA (€)"]}>
            {byClubToShow.map((r, i) => {
              const rank = i + 1;
              const maxEuros = byClub[0]?.euros || 1;
              const pct = Math.round(r.euros / maxEuros * 100);
              const medal = rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":null;
              return (
                <tr key={r.club} style={{ borderBottom: "1px solid #f5f5f5", background: i%2===0?"white":"#fdfcfc" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#fafafa"}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"white":"#fdfcfc"}>
                  <td style={{ padding: "12px 8px 12px 16px", width: 36, fontSize: 13, color: "#ccc" }}>
                    {medal || <span style={{ fontFamily: "monospace", fontSize: 11 }}>{rank}</span>}
                  </td>
                  <td style={{ padding: "12px 12px" }}>
                    <div style={{ fontWeight: 500, color: "#222", fontSize: 13 }}>{r.club}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                      <MiniBar pct={pct} />
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#333", fontSize: 13 }}>{r.count}</td>
                  <td style={{ padding: "12px 20px 12px 16px", textAlign: "right", fontWeight: 700, color: "#E10600", fontSize: 13, whiteSpace: "nowrap" }}>{euro(r.euros)}</td>
                </tr>
              );
            })}
            {byClub.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#ccc" }}>—</td></tr>}
          </StyledTable>
          {byClub.length > 5 && (
            <div style={{ padding: "12px 0", borderTop: "1px solid #f5f5f5", textAlign: "center" }}>
              <button onClick={() => setShowAllClubs(v=>!v)} style={{
                border: "1px solid #e8e8e8", borderRadius: 8, padding: "7px 18px",
                background: "white", fontSize: 12, color: "#666", cursor: "pointer",
              }}>
                {showAllClubs ? "Réduire ▲" : `Afficher tout (${byClub.length}) ▼`}
              </button>
            </div>
          )}
        </Card>

        {/* ── TOURNOIS ── */}
        <SectionHeader title="Tournois (Stand)" count={`${tournoiStats.length} tournois`} />
        <Card>
          <StyledTable headers={["Tournoi", "Clubs", "Raquettes", "CA (€)", "Part cordeur (€)"]}>
            {tournoiStatsToShow.map((t, i) => {
  const isOpen = openTournois.has(t.tournoi);

  return (
    <Fragment key={t.tournoi}>
      <tr style={{ borderBottom: "1px solid #f5f5f5", background: i % 2 === 0 ? "white" : "#fdfcfc" }}>
        <td style={{ padding: "12px 12px 12px 20px" }}>
          <button
            onClick={() =>
              setOpenTournois((prev) => {
                const next = new Set(prev);
                if (next.has(t.tournoi)) next.delete(t.tournoi);
                else next.add(t.tournoi);
                return next;
              })
            }
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: "1px solid #e0e0e0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: "#999",
                flexShrink: 0,
              }}
            >
              {isOpen ? "−" : "+"}
            </span>
            <span style={{ fontWeight: 500, color: "#222", fontSize: 13, textAlign: "left" }}>
              {t.tournoi}
            </span>
          </button>
        </td>

        <td style={{ padding: "12px 16px", textAlign: "right", color: "#aaa", fontSize: 12 }}>
          {isOpen ? "—" : `${t.clubsArr.length} clubs`}
        </td>
        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#333", fontSize: 13 }}>
          {t.totalCount}
        </td>
        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#E10600", fontSize: 13 }}>
          {euro(t.ca)}
        </td>
        <td style={{ padding: "12px 20px 12px 16px", textAlign: "right", fontWeight: 600, color: "#333", fontSize: 13 }}>
          {euro(t.cordeur)}
        </td>
      </tr>

      {isOpen && (
        <tr style={{ background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
          <td colSpan={5} style={{ padding: "10px 20px 14px 46px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 400 }}>
              {t.clubsArr.map((c) => (
                <div key={c.club} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555" }}>
                  <span>{c.club}</span>
                  <b>{c.n}</b>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
})}
            {tournoiStats.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#ccc" }}>—</td></tr>}
            {tournoiStats.length > 0 && (() => {
              const totCount=tournoiStats.reduce((a,x)=>a+(x.totalCount||0),0);
              const totCA=tournoiStats.reduce((a,x)=>a+(x.ca||0),0);
              const totCordeur=tournoiStats.reduce((a,x)=>a+(x.cordeur||0),0);
              return (
                <tr style={{ borderTop: "2px solid #f0f0f0", background: "#fafafa" }}>
                  <td style={{ padding: "12px 12px 12px 20px", fontWeight: 700, fontSize: 13, color: "#111" }}>TOTAL</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#ccc" }}>—</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, fontSize: 14 }}>{totCount}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#E10600", fontSize: 14 }}>{euro(totCA)}</td>
                  <td style={{ padding: "12px 20px 12px 16px", textAlign: "right", fontWeight: 700, fontSize: 13 }}>{euro(totCordeur)}</td>
                </tr>
              );
            })()}
          </StyledTable>
          {tournoiStats.length > 5 && (
            <div style={{ padding: "12px 0", borderTop: "1px solid #f5f5f5", textAlign: "center" }}>
              <button onClick={() => setShowAllTournois(v=>!v)} style={{ border: "1px solid #e8e8e8", borderRadius: 8, padding: "7px 18px", background: "white", fontSize: 12, color: "#666", cursor: "pointer" }}>
                {showAllTournois ? "Réduire ▲" : `Afficher tout (${tournoiStats.length}) ▼`}
              </button>
            </div>
          )}
        </Card>

        {/* ── RÉMUNÉRATION CORDEURS ── */}
        <SectionHeader title="Rémunération cordeurs (Magasin)" />
        <Card>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <th style={{ padding: "10px 12px 10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#bbb" }}>Mois</th>
                  {[...CORDEURS_MAGASIN].map(name => (
                    <th key={name} style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#bbb" }}>{name}</th>
                  ))}
                  <th style={{ padding: "10px 20px 10px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#bbb" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {remunMonthsToShow.map((mk, i) => {
                  const row=remunByMonthCordeur.table[mk]||{};
                  const total=Object.values(row).reduce((a,x)=>a+(x||0),0);
                  return (
                    <tr key={mk} style={{ borderBottom: "1px solid #f5f5f5", background: i%2===0?"white":"#fdfcfc" }}>
                      <td style={{ padding: "11px 12px 11px 20px", fontWeight: 500, color: "#333" }}>{monthLabel(mk)}</td>
                      {[...CORDEURS_MAGASIN].map(name => (
                        <td key={name} style={{ padding: "11px 16px", textAlign: "right", color: row[name]?"#333":"#ddd" }}>
                          {row[name] ? euro(row[name]) : "—"}
                        </td>
                      ))}
                      <td style={{ padding: "11px 20px 11px 16px", textAlign: "right", fontWeight: 700, color: "#E10600" }}>{euro(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── MAGASIN VS TOURNOIS ── */}
        <SectionHeader title="Magasin vs Tournois (par mois)" />
        <Card>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                  {["Mois","Marge Magasin (€)","Part cordeurs (€)","Gain Tournoi (€)","Total (€)"].map((h,i) => (
                    <th key={h} style={{ padding: i===0?"10px 12px 10px 20px":"10px 16px", textAlign: i===0?"left":"right", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#bbb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthsComparatifToShow.map((r, i) => {
                  const calc=margeVsTournoiByMonth.get(r.month)||{magasinTotal:0,magasinItems:[],tournoiTotal:0,tournoiItems:[]};
                  const payout=calc.payoutTotal||0;
                  const brutMagasin=calc.magasinTotal||0;
                  const tournoi=calc.tournoiTotal||0;
                  const total=(brutMagasin-payout)+tournoi;
                  return (
                    <tr key={r.month} style={{ borderBottom: "1px solid #f5f5f5", background: i%2===0?"white":"#fdfcfc" }}>
                      <td style={{ padding: "11px 12px 11px 20px", fontWeight: 500, color: "#333" }}>{monthLabel(r.month)}</td>
                      <td style={{ padding: "11px 16px", textAlign: "right" }}>
                        <details>
                          <summary style={{ cursor: "pointer", listStyle: "none", fontWeight: 600, color: "#333" }}>{euro(brutMagasin)}</summary>
                          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                            {calc.magasinItems?.length ? calc.magasinItems.map(it => (
                              <div key={it.cordage} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, color: "#666" }}>
                                <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{it.cordage}</span>
                                <span>{it.count} × {it.rate.toFixed(2)}€</span>
                                <b>{euro(it.total)}</b>
                              </div>
                            )) : <div style={{ color: "#ccc", fontSize: 11 }}>—</div>}
                          </div>
                        </details>
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "right" }}>
                        <details>
                          <summary style={{ cursor: "pointer", listStyle: "none", fontWeight: 600, color: "#333" }}>{euro(payout)}</summary>
                          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                            {calc.payoutByCordeur?.length ? calc.payoutByCordeur.map(c => (
                              <details key={c.cordeur} style={{ marginLeft: 8 }}>
                                <summary style={{ cursor: "pointer", listStyle: "none", fontSize: 12, color: "#444" }}><b>{c.cordeur}</b> — {euro(c.total)}</summary>
                                <div style={{ marginTop: 4, marginLeft: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                                  {c.items.map(it => (
                                    <div key={it.cordage} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, color: "#888" }}>
                                      <span>{it.cordage}</span>
                                      <span>{it.count} × {it.rate.toFixed(2)}€</span>
                                      <b>{euro(it.total)}</b>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )) : <div style={{ color: "#ccc", fontSize: 11 }}>—</div>}
                          </div>
                        </details>
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "right" }}>
                        <details>
                          <summary style={{ cursor: "pointer", listStyle: "none", fontWeight: 600, color: "#333" }}>{euro(tournoi)}</summary>
                          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                            {calc.tournoiItems?.length ? calc.tournoiItems.map(it => (
                              <div key={it.cordage} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, color: "#666" }}>
                                <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{it.cordage}</span>
                                <span>{it.count} × {it.rate.toFixed(2)}€</span>
                                <b>{euro(it.total)}</b>
                              </div>
                            )) : <div style={{ color: "#ccc", fontSize: 11 }}>—</div>}
                          </div>
                        </details>
                      </td>
                      <td style={{ padding: "11px 20px 11px 16px", textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: "#E10600" }}>{euro(total)}</div>
                        <div style={{ fontSize: 10, color: "#ccc", marginTop: 2 }}>({euro(brutMagasin)} − {euro(payout)} + {euro(tournoi)})</div>
                      </td>
                    </tr>
                  );
                })}
                {/* Ligne total saison */}
                {(() => {
                  const seasonMagasin=revenueByMonth.rows.reduce((a,x)=>a+(margeVsTournoiByMonth.get(x.month)?.magasinTotal||0),0);
                  const seasonPayout=revenueByMonth.rows.reduce((a,x)=>a+(margeVsTournoiByMonth.get(x.month)?.payoutTotal||0),0);
                  const seasonTournoi=revenueByMonth.rows.reduce((a,x)=>a+(margeVsTournoiByMonth.get(x.month)?.tournoiTotal||0),0);
                  const seasonTotal=(seasonMagasin-seasonPayout)+seasonTournoi;
                  return (
                    <tr style={{ borderTop: "2px solid #f0f0f0", background: "#fafafa" }}>
                      <td style={{ padding: "12px 12px 12px 20px", fontWeight: 700, color: "#111" }}>Total saison</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#333" }}>{euro(seasonMagasin)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#333" }}>{euro(seasonPayout)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#333" }}>{euro(seasonTournoi)}</td>
                      <td style={{ padding: "12px 20px 12px 16px", textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: "#E10600", fontSize: 14 }}>{euro(seasonTotal)}</div>
                        <div style={{ fontSize: 10, color: "#ccc", marginTop: 2 }}>({euro(seasonMagasin)} − {euro(seasonPayout)} + {euro(seasonTournoi)})</div>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
