// src/main.jsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";
import Login from "./pages/Login";

import App from "./App";
import Clients from "./pages/Clients";
import Clubs from "./pages/Clubs";
import Stats from "./pages/Stats";
import TournoisPage from "./pages/TournoisPage";
import Donnees from "./pages/Donnees";

import "./index.css";
import logo from "./assets/sportminedor-logo.png";

import TopNav from "./components/Layout/TopNav";

// On n'utilise pas CenteredModal ici pour éviter la modale dans la modale
import SuiviForm from "./components/SuiviForm";
import { isDonneesUnlocked, DONNEES_UNLOCK_KEY } from "./components/PasscodeGate";

// NavLink : icônes NON soulignées, seul le texte l'est quand actif
const linkCls = ({ isActive }) =>
  [
    "group inline-flex items-center gap-2",
    "h-10 px-3 rounded-md",
    "hover:bg-white/10",
    "transition",
    isActive ? "bg-white/15 font-semibold" : "opacity-80 hover:opacity-100",
  ].join(" ");
const linkTextCls =
  "group-aria-[current=page]:underline group-aria-[current=page]:decoration-brand-red";

// Modale inline : overlay + CARTE blanche (header intégré) + contenu
function OverlayModal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-20 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
      {/* carte */}
      <div
        className="relative z-[10000] w-full max-w-5xl mx-4 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-brand-dark flex items-center gap-2 leading-none">
              <span aria-hidden>🎾</span>
              <span>Ajouter une raquette</span>
            </h2>

            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              className="h-9 w-9 rounded-full hover:bg-gray-100 text-brand-dark flex items-center justify-center text-xl"
            >
              ×
            </button>
          </div>

          {/* contenu : on laisse SuiviForm tel quel ; overflow-hidden évite l'effet “carte dans carte” */}
          <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(85vh-72px)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  const [unlocked, setUnlocked] = useState(isDonneesUnlocked());
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!addOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [addOpen]);

  // maj cadenas Données en live (storage/focus)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === DONNEES_UNLOCK_KEY) setUnlocked(isDonneesUnlocked());
    };
    const onFocus = () => setUnlocked(isDonneesUnlocked());
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <>
      {/* Barre de navigation (remplacée par le composant dédié) */}
      {!isLoginPage && (
        <TopNav unlocked={unlocked} onAddClick={() => setAddOpen(true)} />
      )}

      {/* Routes */}
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Private: tout le reste */}
        <Route element={<ProtectedRoute />}>
          <Route path="/suivi" element={<App />} />
          <Route path="/" element={<Navigate to="/suivi" replace />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/donnees" element={<Donnees />} />
          <Route path="/tournois" element={<TournoisPage />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clubs" element={<Clubs />} />
        </Route>
      </Routes>

      {/* Modale : une seule carte, titre intégré, pas de bouton “OK” séparé */}
      {!isLoginPage && (
        <OverlayModal
          open={addOpen}
          title="🎾 Ajouter une raquette"
          onClose={() => setAddOpen(false)}
        >
          <SuiviForm
            editingId={null}
            initialData={null}
            onDone={() => {
              setAddOpen(false);
              window.dispatchEvent(new CustomEvent("suivi:created"));
            }}
          />
        </OverlayModal>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
