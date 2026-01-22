import { useEffect, useMemo, useState } from "react"; 
import { supabase } from "./utils/supabaseClient"; 
import SuiviSeasonView from "./components/SuiviSeasonView";
import BackButton from "./components/BackButton"; // ou "../components/BackButton" 
import logo from "./assets/sportminedor-logo.png"
import { useNavigate } from "react-router-dom";
import SuiviResponsive from "./components/SuiviResponsive";

function TournamentAlerts() {
  const navigate = useNavigate();

function openTournoi(tournoiName) {
  // va sur l’onglet Tournois
  navigate("/tournois");
  // demande l’ouverture du tournoi précis (listener déjà en place dans TournoisPage)
  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent("tournoi:open", { detail: { id: String(tournoiName) } })
    );
  }, 60);
}
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // On récupère tout (la table a déjà "tournoi" chez toi)
        const { data, error } = await supabase
          .from("tournois")
          .select("*")
          .order("tournoi");
        if (error) throw error;
        if (!mounted) return;
        setItems(data || []);
      } catch (e) {
        console.warn("tournois:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    
    // Optionnel : live refresh si tu modifies souvent
    const ch = supabase
      .channel("tournois:alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournois" }, () => {
        // re-fetch
        (async () => {
          const { data } = await supabase.from("tournois").select("*").order("tournoi");
          setItems(data || []);
        })();
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const visible = useMemo(() => {
    const today = new Date();
    return (items || []).map(row => {
      // Détecte les colonnes de dates possibles
      const start =
        parseDateLoose(row.start_date) ||
        parseDateLoose(row.debut) ||
        parseDateLoose(row.date_debut) ||
        parseDateLoose(row.date);
      // fin = end || start (tournoi d’un jour)
      const end =
        parseDateLoose(row.end_date) ||
        parseDateLoose(row.fin) ||
        parseDateLoose(row.date_fin) ||
        start;

      if (!start) return null;
      if (!isWithinWindow(today, start, end)) return null;

      return {
        key: row.id ?? row.tournoi ?? JSON.stringify(row),
        name: row.tournoi || row.nom || "Tournoi",   // ← nom exact pour l’ouverture
        title: row.tournoi || row.nom || "Tournoi",
        start, end,
        lieu: row.lieu || row.club || row.ville || "",
      };
    }).filter(Boolean);
  }, [items]);

  if (loading) return null;
  if (!visible.length) return null;

  return (
    <div className="mb-4 space-y-2">
      {visible.map((t) => (
  <div
    key={t.key}
    role="button"
    tabIndex={0}
    onClick={() => openTournoi(t.name)}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTournoi(t.name); }
    }}
    className="
      block rounded-xl border border-amber-300 bg-amber-50
      hover:bg-amber-100 transition p-3 cursor-pointer
    "
  >
    <div className="flex items-start gap-3">
      <div className="text-2xl leading-none">🏆</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-amber-900 truncate">
          Tournoi à proximité : {t.title}
        </div>
        <div className="text-sm text-amber-900/80">
          {t.lieu ? `${t.lieu} — ` : ""}
          du {t.start.toLocaleDateString("fr-FR")} au {t.end.toLocaleDateString("fr-FR")}
        </div>
      </div>
    </div>
  </div>
))}
    </div>
  );
}

// === Helpers date === 
// Saison = du 1er septembre (année N) au 31 août (année N+1). 
function getSeasonBounds(today = new Date()) { 
  const y = today.getFullYear(); 
  const m = today.getMonth(); // 0=janvier, 8=septembre 
  const seasonStartYear = m >= 8 ? y : y - 1; // si on est en sept (8) ou après → début = 1 sept année courante, sinon année précédente 
  const start = new Date(seasonStartYear, 8, 1);  // 1 sept 
  const end   = new Date(seasonStartYear + 1, 7, 31, 23, 59, 59, 999); // 31 août inclus 
  // formats YYYY-MM-DD 
  const toISO = (d) => d.toISOString().slice(0, 10); 
  return { startISO: toISO(start), endISO: toISO(end) }; 
} 

function getMonthBounds(today = new Date()) { 
  const y = today.getFullYear(); 
  const m = today.getMonth(); 
  const start = new Date(y, m, 1); 
  const end   = new Date(y, m + 1, 0, 23, 59, 59, 999); 
  const toISO = (d) => d.toISOString().slice(0, 10); 
  return { startISO: toISO(start), endISO: toISO(end) }; 
} 

// helpers dates tolérants
function parseDateLoose(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!isNaN(+d)) return d;
  // "YYYY-MM-DD"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  return null;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function isWithinWindow(today, start, end) {
  // fenêtre visible = [start-2j, end+2j]
  const from = addDays(start, -2);
  const to   = addDays(end, 2);
  return today >= from && today <= to;
}

// === Helpers argent === 

const euro = (n) => `${(Number(n) || 0).toLocaleString("fr-FR")} €`; 
const parseMoney = (v) => { 
  if (v == null) return 0; 
  const s = String(v).replace(/\s/g, ""); 
  const m = s.match(/-?\d+(?:[.,]\d+)?/); 
  return m ? parseFloat(m[0].replace(",", ".")) : 0; 
}; 

export default function App() { 
const [statsReloadKey, setStatsReloadKey] = useState(0); 
const [loading, setLoading] = useState(true); 
const [err, setErr] = useState(""); 
const [stats, setStats] = useState({ 
    saisonTotal: null, 
    aFaire: null, 
    moisTotal: null, 
    moisRevenue: 0, 
}); 

const { startISO: seasonStart, endISO: seasonEnd } = useMemo(() => getSeasonBounds(new Date()), []); 
const { startISO: monthStart, endISO: monthEnd }   = useMemo(() => getMonthBounds(new Date()), []); 

useEffect(() => { 
    const bump = () => setStatsReloadKey((k) => k + 1); 
    window.addEventListener("suivi:created", bump); 
    window.addEventListener("suivi:updated", bump); 
    window.addEventListener("suivi:deleted", bump); 
    return () => { 
      window.removeEventListener("suivi:created", bump); 
      window.removeEventListener("suivi:updated", bump); 
      window.removeEventListener("suivi:deleted", bump); 
    }; 
  }, []);   

  useEffect(() => { 
    async function load() { 
      setLoading(true); 
      setErr(""); 
      try { 
        // Compteurs 
        const qSaison = supabase 
          .from("suivi") 
          .select("id", { count: "exact", head: true }) 
          .gte("date", seasonStart) 
          .lte("date", seasonEnd) 
          .neq("statut_id", "A FAIRE"); 
        const qAFaire = supabase 
          .from("suivi") 
          .select("id", { count: "exact", head: true }) 
          .eq("statut_id", "A FAIRE"); 
        const qMois = supabase 
          .from("suivi") 
          .select("id", { count: "exact", head: true }) 
          .gte("date", monthStart) 
          .lte("date", monthEnd) 
          .neq("statut_id", "A FAIRE"); 
        // € du mois (toutes lignes du mois cordées) 
        const qTarifsMois = supabase 
          .from("suivi") 
          .select("tarif, lieu_id") 
          .gte("date", monthStart) 
          .lte("date", monthEnd) 
          .neq("statut_id", "A FAIRE"); 
        const [saison, aFaire, mois, tarifs] = await Promise.all([ 
          qSaison, qAFaire, qMois, qTarifsMois 
        ]); 
        const firstErr = [saison, aFaire, mois, tarifs].find(r => r.error)?.error; 
        if (firstErr) throw firstErr; 
        // Helpers € 
        const parseMoney = (v) => { 
          if (v == null) return 0; 
          const s = String(v).replace(/\s/g, ""); 
          const m = s.match(/-?\d+(?:[.,]\d+)?/); 
          return m ? parseFloat(m[0].replace(",", ".")) : 0; 
        }; 
        const moisRevenue = (tarifs?.data ?? []).reduce((sum, row) => { 
          const s = String(row.tarif ?? "").replace(/\s/g, ""); 
          const m = s.match(/-?\d+(?:[.,]\d+)?/); 
          const val = m ? parseFloat(m[0].replace(",", ".")) : 0; 
          return sum + val; 
        }, 0); 
        setStats({ 
          saisonTotal: saison.count ?? 0, 
          aFaire: aFaire.count ?? 0, 
          moisTotal: mois.count ?? 0, 
          moisRevenue, // ⬅️ utilise la somme calculée ci-dessus 
        }); 
      } catch (e) { 
        console.error(e); 
        setErr(e.message || "Erreur inconnue"); 
      } finally { 
        setLoading(false); 
      } 
    } 
    load(); 
  }, [seasonStart, seasonEnd, monthStart, monthEnd, statsReloadKey]); 
  return ( 
    <div className="min-h-screen bg-brand-gray py-8 px-4"> 
  <div className="w-[92vw] max-w-[1400px] mx-auto"> 
    
    {/* Titre + cartes sur UNE ligne */}
<div className="flex items-center gap-4 mb-4">
  {/* Titre */}
  <img src={logo} alt="" className="h-8 w-8 rounded-full select-none" />
  <div className="flex items-center gap-2 shrink-0">
    <h1 className="text-2xl font-bold flex items-center gap-2">Suivi</h1>
  </div>

  {/* Cartes (collées à droite) */}
  <div className="ml-auto mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
    <Card title="Raquettes à faire" value={fmt(stats.aFaire, loading, err)} />
    <Card title="Cordées (cette saison)" value={fmt(stats.saisonTotal, loading, err)} />
    <Card title="Cordées (ce mois)" value={fmt(stats.moisTotal, loading, err)} />
    <Card title="Argent généré (ce mois)" value={loading ? "…" : err ? "ERR" : euro(stats.moisRevenue)} />
  </div>
</div>

{/* 👉 Bandeau tournois entre le titre et les cartes */}
<TournamentAlerts />

 {/* Nouvelle vue Saison → Mois */} 
        <div className="mt-8"> 
          <SuiviSeasonView /> 
        </div> 
      </div> 
    </div> 
  ); 
}
function fmt(value, loading, err) { 
  if (loading) return "…"; 
  if (err) return "ERR"; 
  return typeof value === "number" ? value : "—"; 
} 

function Card({ title, value }) { 
  return ( 
    <div className="bg-white rounded-xl shadow-card p-5 text-center border border-gray-100"> 
      <div className="text-sm text-gray-500">{title}</div> 
      <div className="mt-1 text-3xl font-extrabold tracking-tight">{value}</div> 
      <div className="mt-3 h-1 w-10 mx-auto rounded bg-brand-red" /> 
    </div> 
  ); 
} 