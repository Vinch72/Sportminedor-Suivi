// src/components/tournois/TournoiList.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { IconEdit, IconTrash } from "../ui/Icons";

// helpers
const normStr = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const toISO = (v) => {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(+d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const d2 = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${d2}`;
};

const displayDate = (d) =>
  !d ? "—" : /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date(d).toLocaleDateString("fr-FR");

const dayCountLabel = (start, end) => {
  const s = toISO(start);
  const e = toISO(end);
  if (!s) return "";
  if (!e || e === s) return "1 jour";
  const ds = new Date(s + "T00:00:00");
  const de = new Date(e + "T00:00:00");
  const diff = Math.round((de - ds) / (1000 * 60 * 60 * 24)) + 1;
  if (!isFinite(diff) || diff <= 0) return "";
  return diff === 1 ? "1 jour" : `${diff} jours`;
};

// ✅ Saison = 01/09 -> 31/08
const getSeasonStartYear = (iso) => {
  // iso: "YYYY-MM-DD"
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)); // 1..12
  // Septembre (9) -> Décembre => saison commence l'année courante
  // Janvier -> Août => saison commence l'année précédente
  return m >= 9 ? y : y - 1;
};

const seasonLabelFromISO = (iso) => {
  const sy = getSeasonStartYear(iso);
  if (sy == null) return "Sans saison";
  return `Saison ${sy}-${sy + 1}`;
};

// ordre des mois dans une saison : Sep(0)..Aug(11)
const monthOrderInSeason = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 999;
  const m = Number(iso.slice(5, 7));
  return m >= 9 ? (m - 9) : (m + 3);
};

const monthLabelFromISO = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Sans date";
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
};

const getSortDateISO = (t) => {
  // on trie/groupe avec la date de début en priorité
  const sd = toISO(t.start_date);
  const ed = toISO(t.end_date);
  return sd || ed || "";
};

const monthIndex = (ym) => {
  // ym = "YYYY-MM"
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7)); // 1..12
  return y * 12 + (m - 1);
};

const monthDistance = (aYM, bYM) => {
  const a = monthIndex(aYM);
  const b = monthIndex(bYM);
  if (a == null || b == null) return 999999;
  return Math.abs(a - b);
};

export default function TournoiList({ onEdit, onOpen, query = "" }) {
  const [rows, setRows] = useState([]);
  const [cordeursBy, setCordeursBy] = useState({});
  const [err, setErr] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(null); // { tournoi, dates, cordeurs }

    // ✅ UI: saisons/mois repliables
  const [openSeasons, setOpenSeasons] = useState(() => new Set());
  const [openMonths, setOpenMonths] = useState(() => new Set());

  const todayISO = toISO(new Date());
  const currentSeasonKey = String(getSeasonStartYear(todayISO)); // ex: "2025"
  const currentMonthKey = todayISO ? todayISO.slice(0, 7) : "";   // ex: "2026-02"

  async function load() {
    setErr("");
    try {
      // 1) tentative moderne: colonnes start_date/end_date
      let res = await supabase
        .from("tournois")
        .select("tournoi, start_date, end_date, date, infos")
        .order("start_date", { ascending: true, nullsFirst: true })
        .order("end_date",   { ascending: true, nullsFirst: true })
        .order("date",       { ascending: true, nullsFirst: true });

      // 2) fallback si la vue n'a pas ces colonnes (code 42703) ou 400
      if (res.error) {
        // essai minimaliste sur la même table
        res = await supabase
          .from("tournois")
          .select("tournoi, infos")
          .order("tournoi", { ascending: true });
      }

      if (res.error) throw res.error;

      const data = res.data || [];
      // ⛔️ Ne pas afficher "Magasin" dans la page Tournois
      const normalized = data
        .filter((t) => String(t.tournoi).trim().toLowerCase() !== "magasin")
        .map((t) => ({
        tournoi: t.tournoi,
        start_date: t.start_date || t.date || null,
        end_date: t.end_date || t.date || null,
        infos: t.infos || "",
      }));

      setRows(normalized);

      if (normalized.length) {
        const names = normalized.map((d) => d.tournoi);
        const links = await supabase
          .from("tournoi_cordeurs")
          .select("tournoi, cordeur")
          .in("tournoi", names);

        if (!links.error) {
          const map = {};
          (links.data || []).forEach((l) => {
            map[l.tournoi] = [...(map[l.tournoi] || []), l.cordeur];
          });
          setCordeursBy(map);
        } else {
          setCordeursBy({});
        }
      } else {
        setCordeursBy({});
      }
    } catch (e) {
      console.warn("tournois_list load error:", e);
      setErr(e.message || "Erreur de chargement");
      setRows([]);
      setCordeursBy({});
    }
  }

  useEffect(() => {
    load();
        // ✅ par défaut : saison en cours + mois en cours ouverts
    setOpenSeasons(new Set([currentSeasonKey]));
    setOpenMonths(new Set([currentMonthKey]));
    const onU = () => load();
    window.addEventListener("tournois:updated", onU);
    return () => window.removeEventListener("tournois:updated", onU);
  }, []);

  // 🔎 filtrage compact (nom / dates / cordeur / infos)
  const filtered = useMemo(() => {
    const q = normStr(query);
    if (!q) return rows;

    return rows.filter((t) => {
      const name = normStr(t.tournoi);
      const sd = toISO(t.start_date);
      const ed = toISO(t.end_date);
      const infos = normStr(t.infos);
      const cords = normStr((cordeursBy[t.tournoi] || []).join(" "));

      return (
        name.includes(q) ||
        infos.includes(q) ||
        cords.includes(q) ||
        sd.includes(q) ||
        ed.includes(q)
      );
    });
  }, [rows, query, cordeursBy]);

    // ✅ Groupage : Saison -> Mois -> Tournois
  const grouped = useMemo(() => {
    // tri global par date (puis nom)
    const items = [...filtered].sort((a, b) => {
      const da = getSortDateISO(a);
      const db = getSortDateISO(b);
      if (da !== db) return da.localeCompare(db);
      return String(a.tournoi).localeCompare(String(b.tournoi));
    });

    const seasonsMap = new Map();

    for (const t of items) {
      const iso = getSortDateISO(t);
      const seasonStartYear = getSeasonStartYear(iso);
      const seasonKey = seasonStartYear == null ? "NO_SEASON" : String(seasonStartYear);
      const seasonLabel = seasonLabelFromISO(iso);

      if (!seasonsMap.has(seasonKey)) {
        seasonsMap.set(seasonKey, { seasonKey, seasonLabel, months: new Map() });
      }

      const seasonObj = seasonsMap.get(seasonKey);
      const monthKey = iso ? iso.slice(0, 7) : "NO_DATE"; // "YYYY-MM"
      const monthLabel = monthLabelFromISO(iso);
      const monthOrder = monthOrderInSeason(iso);

      if (!seasonObj.months.has(monthKey)) {
        seasonObj.months.set(monthKey, { monthKey, monthLabel, monthOrder, items: [] });
      }

      seasonObj.months.get(monthKey).items.push(t);
    }

    // transform Map -> Array + tri saisons / mois
    const seasonsArr = Array.from(seasonsMap.values()).sort((a, b) => {
      // NO_SEASON à la fin
      if (a.seasonKey === "NO_SEASON") return 1;
      if (b.seasonKey === "NO_SEASON") return -1;
      // saisons récentes d'abord
      return Number(b.seasonKey) - Number(a.seasonKey);
    });

    return seasonsArr.map((s) => {
      const monthsArr = Array.from(s.months.values()).sort((a, b) => {
  if (a.monthKey === "NO_DATE") return 1;
  if (b.monthKey === "NO_DATE") return -1;

  // ✅ Si c'est la saison en cours, on met le mois courant en 1er,
  // puis on trie par proximité avec le mois courant (et à égalité: plus récent d'abord)
  const isCurrentSeason = s.seasonKey === currentSeasonKey;
  if (isCurrentSeason) {
    const da = monthDistance(a.monthKey, currentMonthKey);
    const db = monthDistance(b.monthKey, currentMonthKey);
    if (da !== db) return da - db;

    // si même distance, préfère les mois récents
    return b.monthKey.localeCompare(a.monthKey);
  }

  // ✅ Sinon (autres saisons), on garde un tri simple : du plus récent au plus ancien
  return b.monthKey.localeCompare(a.monthKey);
});
      return { ...s, months: monthsArr };
    });
    }, [filtered, currentSeasonKey, currentMonthKey]);

    const toggleSeason = (seasonKey) => {
    setOpenSeasons((prev) => {
      const isOpen = prev.has(seasonKey);

      // ✅ Option A : une seule saison ouverte à la fois
      if (isOpen) return new Set(); // ferme tout

      const next = new Set([seasonKey]); // ouvre uniquement celle-ci
      return next;
    });

    // ✅ Quand on ouvre une saison : on ouvre un seul mois dedans
    // - si c'est la saison courante => mois courant
    // - sinon => le mois le plus récent de la saison (on le choisira via grouped au rendu)
    if (seasonKey === currentSeasonKey) {
      setOpenMonths(new Set([currentMonthKey]));
    } else {
      // on ne connaît pas le meilleur mois ici sans chercher dans grouped
      // donc on réinitialise : l'utilisateur cliquera le mois qu'il veut
      setOpenMonths(new Set());
    }
  };

  const toggleMonth = (monthKey) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  };

  const onDelete = (tournoi) => {
    if (String(tournoi).trim().toLowerCase() === "magasin") {
      alert('Le lieu "Magasin" est réservé et ne peut pas être supprimé ici.');
      return;
    }
    const info = rows.find((r) => r.tournoi === tournoi);
    const dates =
      (info?.start_date || info?.end_date)
        ? `${displayDate(info?.start_date)}${info?.end_date ? " → " + displayDate(info.end_date) : ""}`
        : "—";
    const cords = (cordeursBy[tournoi] || []).join(" • ") || "—";
    setDeleteDialog({ tournoi, dates, cordeurs: cords });
  };  
  
  async function confirmDelete() {
    if (!deleteDialog?.tournoi) return setDeleteDialog(null);
    const name = deleteDialog.tournoi;
    const { error } = await supabase.from("tournois").delete().eq("tournoi", name);
    if (error) { alert("Suppression refusée."); return; }
    setDeleteDialog(null);
    window.dispatchEvent(new CustomEvent("tournois:updated"));
  }  

  return (
    <div className="mt-2">
      {err && <div className="text-sm text-red-600 mb-2">{err}</div>}

                 {grouped.map((season) => (
        <div key={season.seasonKey} className="mb-6">
          <button
            type="button"
            onClick={() => toggleSeason(season.seasonKey)}
            className="w-full text-left text-lg font-bold text-black mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border hover:bg-gray-100"
          >
            <span className="inline-block w-5">
              {openSeasons.has(season.seasonKey) ? "▾" : "▸"}
            </span>
            {season.seasonLabel}
          </button>

          {openSeasons.has(season.seasonKey) && (
            <>
              {season.months.map((month) => (
                <div key={month.monthKey} className="mb-4">
                  <button
                    type="button"
                    onClick={() => toggleMonth(month.monthKey)}
                    className="w-full text-left text-sm font-semibold text-gray-800 mb-2 capitalize flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-gray-50"
                  >
                    <span className="inline-block w-5">
                      {openMonths.has(month.monthKey) ? "▾" : "▸"}
                    </span>
                    {month.monthLabel}
                    <span className="text-gray-400 font-normal">
                      ({month.items.length})
                    </span>
                  </button>

                  {openMonths.has(month.monthKey) && (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {month.items.map((t) => (
                        <div
  key={t.tournoi}
  className="min-w-0 w-full rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
>
  {/* liseré gauche */}
  <div className="flex">
    <div className="w-1.5 bg-[#E10600]" />

    <div className="flex-1 p-4">
      <div className="flex justify-between items-start gap-3 relative">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
  <div className="flex items-center gap-2 min-w-0">
  <div className="font-semibold text-black truncate text-base min-w-0">
    {t.tournoi}
  </div>
</div>
</div>
          <div className="mt-1 text-sm text-gray-600 flex items-center gap-2">
            <span className="opacity-80">📅</span>
            <span>
              {displayDate(t.start_date)}
              {t.end_date ? ` → ${displayDate(t.end_date)}` : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {dayCountLabel(t.start_date, t.end_date) ? (
            <span className="text-xs px-2 py-1 rounded-full border bg-gray-50 text-gray-700 whitespace-nowrap">
              {dayCountLabel(t.start_date, t.end_date)}
            </span>
          ) : null}
          <button
            className="h-9 w-9 rounded-full border bg-white hover:bg-gray-50 flex items-center justify-center"
            onClick={() => onEdit?.(t)}
            aria-label="Éditer"
            title="Éditer"
          >
            <IconEdit />
          </button>

          <button
            className="h-9 w-9 rounded-full border border-red-200 bg-white hover:bg-red-50 flex items-center justify-center"
            onClick={() => onDelete(t.tournoi)}
            aria-label="Supprimer"
            title="Supprimer"
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Cordeurs en "chips" */}
      <div className="mt-3 flex flex-wrap gap-2">
        {(cordeursBy[t.tournoi] || []).length ? (
          (cordeursBy[t.tournoi] || []).map((c) => (
            <span
              key={c}
              className="px-2.5 py-1 rounded-full text-xs border border-gray-200 bg-white text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
              title="Cordeur"
            >
              {c}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </div>

      {/* footer */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between gap-3">
  <button
    type="button"
    onClick={() => onOpen?.(t)}
    className="inline-flex items-center justify-center px-4 h-10 rounded-xl bg-[#E10600] text-white font-semibold text-sm shadow-sm hover:brightness-95 active:scale-[0.99] transition"
    style={{ backgroundColor: "#E10600", color: "#fff" }} // ✅ anti-override CSS
  >
    Ouvrir
  </button>
</div>
    </div>
  </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      ))}
      {filtered.length === 0 && !err && (
        <div className="text-sm text-gray-500">Aucun tournoi.</div>
      )}
      {deleteDialog && (
              <div
                className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40"
                onClick={() => setDeleteDialog(null)}
              >
                <div
                  className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl leading-none">🗑️</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-semibold">
                        Supprimer ce tournoi&nbsp;?
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        <div className="truncate">
                          <b>{deleteDialog.tournoi}</b>
                        </div>
                        <div>Dates : {deleteDialog.dates}</div>
                        <div>Cordeurs : {deleteDialog.cordeurs}</div>
                      </div>
                    </div>
                    <button
                      aria-label="Fermer"
                      className="text-gray-500 hover:text-black"
                      onClick={() => setDeleteDialog(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-3 p-3 rounded-xl border bg-gray-50 text-sm">
                    Cette action est <b>définitive</b>.
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      className="px-4 h-10 rounded-xl border text-gray-700 hover:bg-gray-50"
                      onClick={() => setDeleteDialog(null)}
                    >
                      Annuler
                    </button>
                    <button
                      className="px-4 h-10 rounded-xl bg-red-600 text-white hover:bg-red-700"
                      onClick={confirmDelete}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            )}
    </div>
  );
}