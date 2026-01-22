// src/components/SuiviFilters.jsx
import { useEffect, useMemo, useRef, useState } from "react";

/** Mini ComboBox maison (recherche + suggestions) */
function ComboBox({ label, placeholder, value, onChange, options = [] }) {  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    const q = (value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    if (!q) return options.slice(0, 20);
    return options
      .filter((o) =>
        (o.name || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .includes(q)
      )
      .slice(0, 20);
  }, [value, options]);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="flex flex-col relative" ref={wrapRef}>
      <label className="text-xs font-medium mb-1">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setCursor(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setCursor((c) => Math.min(c + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (e.key === "Enter") {
            if (open && cursor >= 0 && filtered[cursor]) {
              onChange(filtered[cursor].name);
              setOpen(false);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="input input-bordered text-black bg-white placeholder:text-gray-400"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-[100%] left-0 right-0 bg-white border rounded-xl mt-1 max-h-60 overflow-auto shadow">
          {filtered.map((opt, i) => (
            <button
              type="button"
              key={opt.id + "-" + i}
              className={`w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-100 ${i === cursor ? "bg-gray-100" : ""}`}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt.name);
                setOpen(false);
              }}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SuiviFilters({
  filters,
  onChange,
  clients = [],
  clubs = [],
  statuts = [],
  cordeurs = [],
}) {
  return (
    <div className="card bg-white border rounded-2xl p-3 shadow-sm flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 w-full">
        {/* Client: recherche instantanée */}
        <ComboBox
          label="Client"
          placeholder="Tape le nom…"
          value={filters.clientQuery}
          onChange={(v) => onChange({ clientQuery: v })}
          options={clients}
        />

        {/* Téléphone: recherche instantanée */}
<div className="flex flex-col">
  <label className="text-xs font-medium mb-1">Téléphone</label>
  <input
    value={filters.phoneQuery || ""}
    placeholder="06…"
    onChange={(e) => onChange({ phoneQuery: e.target.value })}
    className="input input-bordered text-black bg-white placeholder:text-gray-400"
  />
</div>

        {/* Club: recherche instantanée */}
        <ComboBox
          label="Club"
          placeholder="Tape le club…"
          value={filters.clubQuery}
          onChange={(v) => onChange({ clubQuery: v })}
          options={clubs}
        />

        {/* Statut: select simple */}
        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Statut</label>
          <select
            value={filters.statutId}
            onChange={(e) => onChange({ statutId: e.target.value })}
            className="select select-bordered text-black bg-white"
          >
            <option value="">Tous</option>
            {statuts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Cordeur: select simple */}
        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Cordeur</label>
          <select
            value={filters.cordeurId}
            onChange={(e) => onChange({ cordeurId: e.target.value })}
            className="select select-bordered text-black bg-white"
          >
            <option value="">Tous</option>
            {cordeurs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>


        {/* Date exacte */}
        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Date exacte</label>
          <input
            type="date"
            value={filters.dateExact}
            onChange={(e) => onChange({ dateExact: e.target.value })}
            className="input input-bordered text-black"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={() =>
            onChange({
              clientQuery: "",
              phoneQuery: "",
              clubQuery: "",
              statutId: "",
              dateExact: "",
            })
          }
          className="icon-btn"
          title="Réinitialiser"
        >
          🔄
        </button>
        <button
          onClick={() => {}}
          className="btn-red"
          style={{ backgroundColor: "#E10600" }}
          title="Filtre actif"
        >
          Filtrer
        </button>
      </div>
    </div>
  );
}
