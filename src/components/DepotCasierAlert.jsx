// src/components/DepotCasierAlert.jsx — bandeau "raquettes en attente dans un casier"
// (page Suivi). Un clic ouvre le casier du club dans la page Clubs.
import { useNavigate } from "react-router-dom";
import { useDepotAlerts } from "../hooks/useDepotAlerts";

const RED = "#E10600";

export default function DepotCasierAlert() {
  const navigate = useNavigate();
  const { total, byClub } = useDepotAlerts(true);
  if (!total) return null;

  const clubs = Object.entries(byClub)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const single = clubs.length <= 1;
  const openCasier = (name) => navigate(name ? `/clubs?casier=${encodeURIComponent(name)}` : "/clubs");

  return (
    <div
      {...(single && {
        role: "button", tabIndex: 0,
        onClick: () => openCasier(clubs[0]?.name),
        onKeyDown: e => (e.key === "Enter" || e.key === " ") && openCasier(clubs[0]?.name),
      })}
      className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${single ? "cursor-pointer hover:shadow transition" : ""}`}
      style={{ borderColor: RED, background: "rgba(225,6,0,0.05)" }}
    >
      <div className="text-2xl shrink-0">📦</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm" style={{ color: RED }}>
          {total} raquette{total > 1 ? "s" : ""} en attente
          {single ? (clubs[0] ? ` dans le casier ${clubs[0].name}` : "") : ` dans ${clubs.length} casiers`}
        </div>
        {single ? (
          <div className="text-xs text-gray-500">Clique pour ouvrir le casier et les ajouter au suivi</div>
        ) : (
          <div className="flex flex-wrap gap-2 mt-2">
            {clubs.map(c => (
              <button key={c.name} type="button" onClick={() => openCasier(c.name)}
                className="text-xs font-semibold px-3 py-1 rounded-full bg-white border hover:shadow transition"
                style={{ borderColor: RED, color: RED }}>
                {c.name} · {c.count} →
              </button>
            ))}
          </div>
        )}
      </div>
      {single && (
        <div className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full text-white" style={{ background: RED }}>
          Ouvrir →
        </div>
      )}
    </div>
  );
}
