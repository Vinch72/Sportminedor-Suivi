// src/components/SuiviResponsive.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const norm = (s) =>
  (s || "").toString().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const badgeCls = (statut) => {
  const s = norm(statut);
  if (s === "a faire") return "bg-amber-100 text-amber-800";
  if (s === "regle" || s === "payé" || s === "paye") return "bg-emerald-100 text-emerald-800";
  return "bg-gray-100 text-gray-800";
};

export default function SuiviResponsive({
  // callbacks optionnels (si tu veux réutiliser tes actions existantes)
  onEdit,         // (row) => void
  onDelete,       // (row) => void
  initialQuery="",// string
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(initialQuery);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // même base que le desktop : on récupère tout et on filtre en mémoire
        const { data, error } = await supabase
          .from("suivi")
          .select("*")
          .order("date", { ascending: false })
          .order("id", { ascending: false });
        if (error) throw error;
        if (alive) setRows(data || []);
      } catch (e) {
        console.error("SuiviResponsive load:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // filtre texte simple (nom, club, cordage, statut…)
  const filtered = useMemo(() => {
    const needle = norm(q);
    if (!needle) return rows;
    return rows.filter(r => {
      const blob = [
        r.nom, r.prenom, r.client_nom, r.client_prenom,
        r.club_id, r.lieu_id,
        r.cordage_id, r.tension,
        r.statut_id, r.tarif, r.remarque,
        r.raquette,
        r.telephone, r.email,
      ].map(x => norm(x)).join(" ");
      return blob.includes(needle);
    });
  }, [rows, q]);

  return (
    <div className="p-4">
      {/* barre de recherche */}
      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full h-11 px-3 rounded-lg border"
          placeholder="Rechercher (nom, club, cordage, statut…)"
        />
      </div>

      {/* état */}
      {loading && <div className="text-sm text-gray-600">Chargement…</div>}
      {!loading && filtered.length === 0 && (
        <div className="text-sm text-gray-500">Aucune raquette.</div>
      )}

      {/* liste en cartes */}
      <ul className="space-y-3">
        {filtered.map((r) => {
          const d = r.date ? new Date(r.date) : null;
          const dateFR = d ? d.toLocaleDateString("fr-FR") : "—";
          const nom = (r.client_nom || r.nom || "—").toString().toUpperCase();
          const prenom = r.client_prenom || r.prenom || "";
          return (
            <li key={r.id} className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-gray-500">{dateFR}</div>
                  <div className="font-semibold truncate">
                    {nom} {prenom}
                  </div>
                  <div className="text-sm text-gray-700 mt-0.5 truncate">
                    {r.raquette || "—"}
                  </div>
                </div>

                {/* statut */}
                <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${badgeCls(r.statut_id)}`}>
                  {r.statut_id || "—"}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="truncate">
                  <span className="text-gray-500">Cordage : </span>
                  <b>{r.cordage_id || "—"}</b>
                </div>
                <div className="truncate">
                  <span className="text-gray-500">Tension : </span>
                  <b>{r.tension || "—"}</b>
                </div>
                <div className="truncate">
                  <span className="text-gray-500">Lieu : </span>
                  <b>{r.club_id || r.lieu_id || "—"}</b>
                </div>
                <div className="truncate">
                  <span className="text-gray-500">Tarif : </span>
                  <b>{r.tarif || "—"}</b>
                </div>
              </div>

              {(r.remarque || r.notes) && (
                <div className="mt-2 text-xs text-gray-600">
                  📝 {(r.remarque || r.notes).length > 120
                        ? (r.remarque || r.notes).slice(0,120) + "…"
                        : (r.remarque || r.notes)}
                </div>
              )}

              <div className="mt-3 flex justify-end gap-2">
                <button
                  className="px-3 h-9 rounded-lg border hover:bg-gray-50"
                  onClick={() => onEdit?.(r)}
                >
                  Éditer
                </button>
                <button
                  className="px-3 h-9 rounded-lg bg-red-600 text-white hover:bg-red-700"
                  onClick={() => onDelete?.(r)}
                >
                  Supprimer
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* petite marge bas pour scroller sous le bouton + nav */}
      <div className="h-8" />
    </div>
  );
}
