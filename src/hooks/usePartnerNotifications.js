import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const STORE_ID = "sportminedor";

export function usePartnerNotifications() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    async function load() {
      const { count } = await supabase
        .from("partner_notifications")
        .select("id", { count: "exact", head: true })
        .eq("store_id", STORE_ID)
        .eq("read", false);
      setUnread(count ?? 0);
    }

    load();

    const ch = supabase.channel("partner_notifs:" + STORE_ID)
      .on("postgres_changes", { event: "*", schema: "public", table: "partner_notifications", filter: `store_id=eq.${STORE_ID}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "partner_orders",        filter: `store_id=eq.${STORE_ID}` }, load)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, []);

  return unread;
}
