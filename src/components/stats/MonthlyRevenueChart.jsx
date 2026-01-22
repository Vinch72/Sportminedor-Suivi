// src/components/stats/MonthlyRevenueChart.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

const euro = (n) =>
  (Number(n) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";

const parseMoney = (v) => {
  if (v == null) return 0;
  const s = String(v).replace(/\s/g, "");
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(",", ".")) : 0;
};

function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function labelFR(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", {
    month: "2-digit",
    year: "numeric",
  });
}

export default function MonthlyRevenueChart() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Saison fixe : 01/08/2025 → 31/08/2026
  const { startISO, endISO, months } = useMemo(() => {
    const start = new Date(2025, 7, 1);                 // 1 août 2025
    start.setHours(0, 0, 0, 0);
    const end = new Date(2026, 7, 31, 23, 59, 59, 999); // 31 août 2026 inclus

    const list = [];
    const cur = new Date(start);
    while (cur <= end) {
      list.push(monthKey(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    const toISO = (d) => d.toISOString().slice(0, 10);
    return { startISO: toISO(start), endISO: toISO(end), months: list };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("suivi")
          .select("date, tarif, statut_id")
          .gte("date", startISO)
          .lte("date", endISO)
          .neq("statut_id", "A FAIRE"); // on exclut “A FAIRE”
        if (error) throw error;
        setRows(data || []);
      } catch (e) {
        console.warn("MonthlyRevenueChart:", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [startISO, endISO]);

  const data = useMemo(() => {
    const map = new Map(months.map((k) => [k, 0]));
    for (const r of rows) {
      const d = new Date(r.date);
      if (isNaN(+d)) continue;
      const key = monthKey(d);
      if (!map.has(key)) continue;
      map.set(key, (map.get(key) || 0) + parseMoney(r.tarif));
    }
    return months.map((k) => ({
      k,
      label: labelFR(k),
      total: Math.max(0, Math.round(map.get(k) || 0)),
    }));
  }, [rows, months]);

  // Forcer le scroll horizontal (≈80px/point)
  const chartWidthPx = Math.max(700, data.length * 80);

  return (
    <div className="bg-white rounded-xl shadow-card p-5 border border-gray-100">
      <div className="text-lg font-semibold mb-3">Évolution des revenus mensuels</div>
      <div className="overflow-x-auto">
        <div style={{ width: chartWidthPx, height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <Tooltip
                formatter={(v) => euro(v)}
                labelFormatter={(l, p) => p?.[0]?.payload?.label || l}
              />
              <Line type="monotone" dataKey="total" dot strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {!loading && data.length > 0 && (
        <div className="mt-2 text-sm text-gray-500">
          Période : {labelFR(months[0])} → {labelFR(months[months.length - 1])}
        </div>
      )}
    </div>
  );
}
