// src/hooks/useStats.js
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";

// Périodes utiles
const firstDayOfMonth = (d=new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const lastDayOfMonth  = (d=new Date()) => new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999);
const startOfSeason = () => {
  const now = new Date();
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 8, 1); // 1er sept
};
const normPAYE = (s) => (s||"").normalize("NFD").replace(/\p{Diacritic}/gu,"").toUpperCase()==="PAYE";

export function useStats({ from=null, to=null, cordeur=null, club=null } = {}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [cordages, setCordages] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [tarifMatrix, setTarifMatrix] = useState([]);

  // charge toutes les lignes SUIVI dans la période + lookups
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const f = from || firstDayOfMonth();
      const t = to   || lastDayOfMonth();

      const q = supabase
        .from("suivi")
        .select("*")
        .gte("date", f.toISOString())
        .lte("date", t.toISOString())
        .order("date", { ascending: false });

      if (cordeur) q.eq("cordeur_id", cordeur);
      if (club)    q.eq("club_id", club);

      const [{ data: suivi, error: e1 }, { data: cg, error: e2 }, { data: cl, error: e3 }, { data: tm, error: e4 }] =
        await Promise.all([
          q,
          supabase.from("cordages").select("cordage, is_base, Couleur"),
          supabase.from("clubs").select("clubs, bobine_base, bobine_specific"),
          supabase.from("tarif_matrix").select("*"),
        ]);
      if (e1 || e2 || e3 || e4) throw (e1||e2||e3||e4);

      setRows(suivi || []);
      setCordages(cg || []);
      setClubs(cl || []);
      setTarifMatrix(tm || []);
    } finally {
      setLoading(false);
    }
  }, [from, to, cordeur, club]);

  useEffect(() => { load(); }, [load]);

  // calcul tarif (mêmes règles que ton suivi)
  const priceOf = useCallback((r) => {
    if (r?.offert) return 0;
    if (r?.fourni) return 12;
    const clubRow = clubs.find(c => c.clubs === r.club_id);
    const cordageRow = cordages.find(cg => cg.cordage === r.cordage_id);
    if (!clubRow || !cordageRow) return 0;
    const match = tarifMatrix.find(tm =>
      !!tm.bobine_base     === !!clubRow.bobine_base &&
      !!tm.bobine_specific === !!clubRow.bobine_specific &&
      !!tm.is_base         === !!cordageRow.is_base
    );
    return match ? (match.price_cents||0)/100 : 0;
  }, [clubs, cordages, tarifMatrix]);

  // agrégats
  const stats = useMemo(() => {
    const byMonth = new Map();   // key: YYYY-MM -> {nb, ca}
    const byCordeur = new Map(); // key: cordeur_id -> {nb, ca}
    const byClub = new Map();    // key: club_id -> {nb, ca}
    const byCordage = new Map(); // key: cordage_id -> nb
    let nbThisMonth = 0, caThisMonth = 0, aReglerCount = 0, aReglerCA = 0;
    let todayCount = 0, weekCount = 0;

    const today = new Date();
    const startWeek = new Date(today);
    startWeek.setDate(today.getDate() - today.getDay() + 1); // Lundi

    rows.forEach(r => {
      const d = new Date(r.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const price = priceOf(r);
      const isDone = r.statut_id && r.statut_id !== "A FAIRE";

      // per month
      const m = byMonth.get(monthKey) || { nb:0, ca:0 };
      if (isDone) {
        m.nb += 1;
        m.ca += price;
      }
      byMonth.set(monthKey, m);

      // this month KPIs
      if (d >= firstDayOfMonth(today) && d <= lastDayOfMonth(today) && isDone) {
        nbThisMonth += 1;
        caThisMonth += price;
      }

      // a regler
      if (r.statut_id === "A REGLER") {
        aReglerCount += 1;
        aReglerCA += price;
      }

      // today/week
      if (d.toDateString() === today.toDateString() && isDone) todayCount += 1;
      if (d >= startWeek && isDone) weekCount += 1;

      // cordeur / club / cordage
      const bc = byCordeur.get(r.cordeur_id) || { nb:0, ca:0 };
      if (isDone) { bc.nb += 1; bc.ca += price; }
      byCordeur.set(r.cordeur_id, bc);

      const bcl = byClub.get(r.club_id) || { nb:0, ca:0 };
      if (isDone) { bcl.nb += 1; bcl.ca += price; }
      byClub.set(r.club_id, bcl);

      byCordage.set(r.cordage_id, (byCordage.get(r.cordage_id) || 0) + (isDone ? 1 : 0));
    });

    const monthlySeries = Array.from(byMonth.entries())
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([k, v]) => ({ mois: k, nb: v.nb, ca: Math.round(v.ca) }));

    const panier = nbThisMonth ? Math.round((caThisMonth/nbThisMonth)*100)/100 : 0;

    return {
      monthlySeries,
      kpis: {
        nbThisMonth,
        caThisMonth: Math.round(caThisMonth),
        panierMoyen: panier,
        aReglerCount,
        aReglerCA: Math.round(aReglerCA),
        todayCount,
        weekCount,
      },
      byCordeur: Array.from(byCordeur.entries()).map(([k,v]) => ({ cordeur: k, ...v })),
      byClub:    Array.from(byClub.entries()).map(([k,v]) => ({ club: k, ...v })),
      topCordages: Array.from(byCordage.entries())
        .sort((a,b)=>b[1]-a[1]).slice(0,10)
        .map(([cordage_id, nb]) => ({ cordage_id, nb })),
    };
  }, [rows, priceOf]);

  return { loading, rows, priceOf, ...stats, reload: load, defaultRanges: {
    month: { from: firstDayOfMonth(), to: lastDayOfMonth() },
    season: { from: startOfSeason(), to: new Date(startOfSeason().getFullYear()+1, 7, 31, 23,59,59,999) },
  }};
}
