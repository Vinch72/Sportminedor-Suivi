// src/pages/TournoisPage.jsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import TournoiForm from "../components/tournois/TournoiForm";
import TournoiList from "../components/tournois/TournoiList";
import TournoiDetailModal from "../components/tournois/TournoiDetailModal";
import TournoiVentesModal from "../components/tournois/TournoiVentesModal";
import logo from "../assets/sportminedor-logo.png";

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key) || null;
}
function setParams(open, ventes) {
  const url = new URL(window.location.href);
  if (open) url.searchParams.set("open", open);
  else url.searchParams.delete("open");
  if (ventes) url.searchParams.set("ventes", ventes);
  else url.searchParams.delete("ventes");
  window.history.replaceState(null, "", url.toString());
}

export default function TournoisPage() {
  const [editing, setEditing] = useState(null);
  const [opened, setOpened] = useState(() => {
    const p = getParam("open");
    return p ? { tournoi: p } : null;
  });
  const [query, setQuery] = useState("");
  const [openedVentes, setOpenedVentes] = useState(() => {
    const p = getParam("ventes");
    return p ? { tournoi: p } : null;
  });
  const [formOpen, setFormOpen] = useState(false);

  // Sync URL → state (popstate)
  useEffect(() => {
    const onPop = () => {
      setOpened(getParam("open") ? { tournoi: getParam("open") } : null);
      setOpenedVentes(getParam("ventes") ? { tournoi: getParam("ventes") } : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Sync state → URL
  useEffect(() => {
    setParams(opened?.tournoi ?? null, openedVentes?.tournoi ?? null);
  }, [opened, openedVentes]);

  useEffect(() => {
    const onOpen = (e) => {
      const id = e?.detail?.id;
      if (!id) return;
      setOpened({ tournoi: String(id) });
    };
    window.addEventListener("tournoi:open", onOpen);
    return () => window.removeEventListener("tournoi:open", onOpen);
  }, []);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <img src={logo} alt="" className="h-7 w-7 rounded-full select-none" />
          <h1 className="text-2xl font-bold">Tournois</h1>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex items-center gap-2 px-4 h-10 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition"
          style={{ background: "#E10600" }}
        >
          + Créer un tournoi
        </button>
      </div>

      {/* 🔎 Barre de recherche compacte (comme Clients/Clubs) */}
      <div className="mt-6">
        <label className="block text-sm text-gray-600 mb-1">Rechercher un tournoi</label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, date (ex: 2025-09-24) ou cordeur…"
            className="w-full h-11 pl-10 pr-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
        </div>
      </div>

      {/* Liste filtrée côté client */}
      <div className="mt-4">
        <TournoiList
  query={query}
  onEdit={(row) => {
    setEditing(row);
    setFormOpen(true);
  }}
  onOpen={(row) => { setOpened(row); }}
  onOpenVentes={(row) => { setOpenedVentes(row); }}
/>
      </div>

      {formOpen && (
        <TournoiFormModal onClose={() => { setEditing(null); setFormOpen(false); }}>
          <TournoiForm
            initial={editing}
            onDone={() => { setEditing(null); setFormOpen(false); }}
          />
        </TournoiFormModal>
      )}

      {opened && <TournoiDetailModal tournoi={opened} onClose={() => { setOpened(null); }} />}
      {openedVentes && <TournoiVentesModal tournoi={openedVentes} onClose={() => setOpenedVentes(null)} />}
    </div>
  );
}

function TournoiFormModal({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 modal-overlay" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center px-4 py-8">
        <div
          className="relative bg-white shadow-2xl rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-base">Tournoi</h3>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-gray-50"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
