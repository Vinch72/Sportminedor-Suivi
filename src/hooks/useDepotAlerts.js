// src/hooks/useDepotAlerts.js — dépôts casier en attente (temps réel)
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export function useDepotAlerts(enabled = true) {
  const [depots,  setDepots]  = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!enabled) { setDepots([]); setLoading(false); return; }
    const { data } = await supabase
      .from("depot_casier")
      .select("id, club_id, client_club, client_id, client_name, client_phone, raquette_id, raquette_label, cordage_id, cordage_text, tension, notes, fourni, date_depot")
      .eq("converted", false)
      .order("date_depot", { ascending: false });
    setDepots(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!enabled) { setDepots([]); setLoading(false); return; }
    load();
    const ch = supabase.channel("depot_casier_watch:" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "depot_casier" }, load)
      .subscribe();
    window.addEventListener("depot:changed", load);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("depot:changed", load);
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const byClub = depots.reduce((acc, d) => { acc[d.club_id] = (acc[d.club_id] || 0) + 1; return acc; }, {});
  return { depots, loading, total: depots.length, byClub, reload: load };
}
