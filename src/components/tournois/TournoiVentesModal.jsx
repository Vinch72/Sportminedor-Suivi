// src/components/tournois/TournoiVentesModal.jsx
import TournoiVentes from "./TournoiVentes";

export default function TournoiVentesModal({ tournoi, onClose }) {
  if (!tournoi) return null;
  const tournoiName = typeof tournoi === "string" ? tournoi : tournoi?.tournoi;
  console.log("tournoiName dans VentesModal:", tournoiName);

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <div
        className="absolute inset-0 bg-white overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header sticky */}
        <div className="sticky top-0 bg-white border-b z-10 px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛒</span>
              <div>
                <div className="text-xl font-semibold">Feuille des ventes</div>
                <div className="text-sm text-gray-500">{tournoiName}</div>
              </div>
            </div>
            <button
              className="icon-btn"
              title="Fermer"
              onClick={onClose}
            >
              ✖
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="max-w-5xl mx-auto px-4 py-6">
          <TournoiVentes tournoiName={tournoiName} />
        </div>
      </div>
    </div>
  );
}