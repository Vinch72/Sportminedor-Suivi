// src/components/CordageInfo.jsx — fiche "i" d'un cordage (jauges + note)
import { CORDAGE_INFO_FIELDS } from "../utils/cordages";

const RED = "#E10600";

export function CordageDotRow({ label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} className="w-2.5 h-2.5 rounded-full"
            style={{ background: n <= value ? RED : "#cbd5e1" }} />
        ))}
      </div>
    </div>
  );
}

export default function CordageInfoCard({ cordage }) {
  return (
    <div className="rounded-xl px-3 py-2.5 space-y-2" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#1e293b" }}>
      {CORDAGE_INFO_FIELDS.map(f => cordage[f.key] > 0 && (
        <CordageDotRow key={f.key} label={f.label} value={cordage[f.key]} />
      ))}
      {cordage.info_note && (
        <p className="text-xs text-slate-500 italic border-t border-slate-200 pt-1.5">{cordage.info_note}</p>
      )}
    </div>
  );
}
