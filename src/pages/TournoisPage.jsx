// src/pages/TournoisPage.jsx
import { useEffect, useState } from "react";
import TournoiForm from "../components/tournois/TournoiForm";
import TournoiList from "../components/tournois/TournoiList";
import TournoiDetailModal from "../components/tournois/TournoiDetailModal";
import logo from "../assets/sportminedor-logo.png";

export default function TournoisPage() {
  const [editing, setEditing] = useState(null);   // {tournoi, start_date, end_date, infos}
  const [opened, setOpened] = useState(null);     // idem
  const [query, setQuery] = useState("");         // 🔎 recherche compacte

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
      <div className="flex items-center gap-2 mb-4">
        <img src={logo} alt="" className="h-7 w-7 rounded-full select-none" />
        <h1 className="text-2xl font-bold">Tournois</h1>
      </div>

      <TournoiForm initial={editing} onDone={() => setEditing(null)} />

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
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onOpen={(row) => setOpened(row)}
        />
      </div>

      {opened && (
        <TournoiDetailModal tournoi={opened} onClose={() => setOpened(null)} />
      )}
    </div>
  );
}
