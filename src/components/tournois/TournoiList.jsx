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

export default function TournoiList({ onEdit, onOpen, query = "" }) {
  const [rows, setRows] = useState([]);
  const [cordeursBy, setCordeursBy] = useState({});
  const [err, setErr] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(null); // { tournoi, dates, cordeurs }

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

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((t) => (
          <div key={t.tournoi} className="card min-w-0 w-full">
            <div className="flex justify-between items-start min-w-0">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-black truncate">{t.tournoi}</div>
                <div className="text-sm text-gray-600">
                  {displayDate(t.start_date)}
                  {t.end_date ? ` → ${displayDate(t.end_date)}` : ""}
                </div>
                <div className="text-sm text-gray-700 mt-1 truncate">
                  {(cordeursBy[t.tournoi] || []).join(" • ") || "—"}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  className="icon-btn"
                  onClick={() => onEdit?.(t)} // passe l’objet normalisé au form
                  aria-label="Éditer" title="Éditer"
                >
                  <IconEdit />
                </button>
                <button
                  className="icon-btn-red"
                  onClick={() => onDelete(t.tournoi)}
                  aria-label="Supprimer" title="Supprimer"
                >
                  <IconTrash />
                </button>
              </div>
            </div>
            <div className="mt-2">
              <button className="text-[#E10600] underline" onClick={() => onOpen?.(t)}>
                Ouvrir
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && !err && (
          <div className="text-sm text-gray-500">Aucun tournoi.</div>
        )}
      </div>
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