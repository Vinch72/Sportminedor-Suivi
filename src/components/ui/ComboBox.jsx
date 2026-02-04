// src/components/ui/ComboBox.jsx
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * ComboBox générique
 * props:
 * - items: Array<{ value: string, label: string }>
 * - value: string | null
 * - onChange: (value: string | null) => void
 * - placeholder?: string
 * - allowCustom?: boolean (par défaut false)
 */
export default function ComboBox({
  items = [],
  value,
  onChange,
  placeholder = "Rechercher…",
  allowCustom = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  const selected = useMemo(
    () => items.find((i) => i.value === value) || null,
    [items, value]
  );

 useEffect(() => {
  const onDown = (e) => {
    if (!rootRef.current) return;
    if (!rootRef.current.contains(e.target)) setOpen(false);
  };
  window.addEventListener("mousedown", onDown);
  return () => window.removeEventListener("mousedown", onDown);
}, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 100);
    return items
      .filter((i) => i.label.toLowerCase().includes(q))
      .slice(0, 100);
  }, [items, query]);

  const pick = (v) => {
    onChange?.(v);
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex items-center gap-2">
        <input
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="border rounded-md px-3 py-2 w-full"
          placeholder={placeholder}
          value={open ? query : selected?.label || ""}
          onFocus={() => {
            setOpen(true);
            setQuery(selected?.label || "");
          }}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
          }}
        />
        {(selected || query) && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setQuery("");
              onChange?.(null);
            }}
            title="Effacer"
          >
            ✖
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-white shadow">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Aucun résultat
              {allowCustom && query && (
                <>
                  {" "}
                  — <button className="underline" onClick={() => pick(query)}>
                    utiliser “{query}”
                  </button>
                </>
              )}
            </div>
          ) : (
            filtered.map((i) => (
              <button
                key={i.value}
                type="button"
                className="block w-full text-left px-3 py-2 text-sm hover:bg-black/5"
                onClick={() => pick(i.value)}
              >
                {i.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
