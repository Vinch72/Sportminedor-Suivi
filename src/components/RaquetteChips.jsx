// src/components/RaquetteChips.jsx — badges "raquettes du client" sous le champ raquette
import { raquetteLabel } from "../utils/raquettes";

export default function RaquetteChips({ raquettes = [], selectedId, onPick }) {
  if (!raquettes.length) return null;
  return (
    <div className="mt-2">
      <div className="text-xs text-gray-400 mb-1">Raquettes du client :</div>
      <div className="flex flex-wrap gap-1.5">
        {raquettes.map(r => {
          const active = r.id === selectedId;
          return (
            <button key={r.id} type="button" onClick={() => onPick(r)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs font-medium transition"
              style={active
                ? { background: "rgba(225,6,0,0.08)", borderColor: "#E10600", color: "#E10600" }
                : { background: "#fff", borderColor: "#e5e7eb", color: "#374151" }}>
              🏸 {raquetteLabel(r)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
