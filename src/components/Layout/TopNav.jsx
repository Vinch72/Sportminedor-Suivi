// src/components/Layout/TopNav.jsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import sportminedorLogo from '../../assets/sportminedor-logo.png'

const linkCls = ({ isActive }) =>
  [
    "group inline-flex items-center gap-2",
    "h-10 px-3 rounded-md",
    "hover:bg-white/10 transition",
    isActive ? "bg-white/15 font-semibold" : "opacity-80 hover:opacity-100",
  ].join(" ");

const linkTextCls =
  "group-aria-[current=page]:underline group-aria-[current=page]:decoration-brand-red";

export default function TopNav({ unlocked, onAddClick }) {
  const [open, setOpen] = useState(false);

  // liens (définis une fois pour desktop + mobile)
  const Links = ({ onNavigate }) => (
    <>
      <NavLink to="/stats" className={linkCls} onClick={onNavigate} title="Statistiques">
        <span aria-hidden>📊</span>
        <span className={linkTextCls}>Statistiques</span>
      </NavLink>
      <NavLink to="/clients" className={linkCls} onClick={onNavigate} title="Clients">
        <span aria-hidden>👥</span>
        <span className={linkTextCls}>Clients</span>
      </NavLink>
      <NavLink to="/clubs" className={linkCls} onClick={onNavigate} title="Clubs">
        <span aria-hidden>🛡️</span>
        <span className={linkTextCls}>Clubs</span>
      </NavLink>
      <NavLink to="/tournois" className={linkCls} onClick={onNavigate} title="Tournois">
        <span aria-hidden>🏆</span>
        <span className={linkTextCls}>Tournois</span>
      </NavLink>
      <NavLink
        to="/donnees"
        className={linkCls}
        onClick={onNavigate}
        title={unlocked ? "Données (déverrouillé)" : "Données (verrouillé)"}
      >
        <span aria-hidden>{unlocked ? "🔓" : "🔒"}</span>
        <span className={linkTextCls}>Données</span>
      </NavLink>
    </>
  );

  return (
    <header className="bg-brand-dark text-white">
      <div className="h-14 px-4 md:px-6 flex items-center gap-3">
        {/* Logo + titre (clique vers /suivi) */}
        <NavLink
          to="/suivi"
          className="inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/20 rounded-md"
          title="Accueil"
          onClick={() => setOpen(false)}
        >
          <img
            src={sportminedorLogo}
            alt="Sportminedor"
            className="h-8 w-8 rounded-full select-none"
            draggable="false"
          />
          <span className="font-semibold">Sportminedor</span>
        </NavLink>

        {/* Liens desktop */}
        <nav className="hidden md:flex items-center gap-2 md:gap-3 ml-2">
          <Links onNavigate={() => {}} />
        </nav>

        {/* Bouton Ajouter (desktop) */}
        <div className="ml-auto hidden md:block">
          <button
            type="button"
            onClick={onAddClick}
            className="inline-flex items-center h-10 px-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold shadow"
          >
            🎾 Ajouter une raquette
          </button>
        </div>

        {/* Burger (mobile) */}
        <button
          type="button"
          className="ml-auto md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-white/10"
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {/* icône burger / close */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <>
                <path d="M3 6h18" />
                <path d="M3 12h18" />
                <path d="M3 18h18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Menu mobile déroulant */}
      {open && (
        <div className="md:hidden border-t border-white/10">
          <nav className="px-3 py-2 flex flex-col gap-1">
            <Links onNavigate={() => setOpen(false)} />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddClick?.();
              }}
              className="mt-2 inline-flex items-center justify-center h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              🎾 Ajouter une raquette
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
