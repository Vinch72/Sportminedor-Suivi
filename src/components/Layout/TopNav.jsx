// src/components/Layout/TopNav.jsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import sportminedorLogo from "../../assets/sportminedor-logo.png";
import { useAuth } from "../../auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

// NavLink ajoute aria-current="page" mais pas de classe "active" en v6.
// On passe une fonction className pour appliquer sidebar-link--active.
const linkCls = ({ isActive }) =>
  isActive ? "sidebar-link sidebar-link--active" : "sidebar-link";

function SidebarContent({ isTournamentOnly, unlocked, onAddClick, onNavigate, onLogout }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5">
        <NavLink
          to={isTournamentOnly ? "/tournois" : "/suivi"}
          className="flex items-center gap-2 focus:outline-none"
          onClick={onNavigate}
          style={{ textDecoration: "none" }}
        >
          <img
            src={sportminedorLogo}
            alt="Sportminedor"
            className="h-8 w-8 rounded-full select-none"
            draggable="false"
          />
          <span className="font-bold text-white text-base">Sportminedor</span>
        </NavLink>
      </div>

      {/* Divider */}
      <div className="sidebar-divider" />

      {/* Nav links */}
      <nav className="flex-1 px-2 space-y-0.5 py-2">
        {!isTournamentOnly && (
          <>
            <NavLink to="/suivi" className={linkCls} onClick={onNavigate}>
              <span aria-hidden>🏸</span>
              <span>Suivi</span>
            </NavLink>
            <NavLink to="/stats" className={linkCls} onClick={onNavigate}>
              <span aria-hidden>📊</span>
              <span>Statistiques</span>
            </NavLink>
            <NavLink to="/clients" className={linkCls} onClick={onNavigate}>
              <span aria-hidden>👥</span>
              <span>Clients</span>
            </NavLink>
            <NavLink to="/clubs" className={linkCls} onClick={onNavigate}>
              <span aria-hidden>🛡️</span>
              <span>Clubs</span>
            </NavLink>
            <NavLink to="/partenariat" className={linkCls} onClick={onNavigate}>
              <span aria-hidden>🤝</span>
              <span>Partenariat</span>
            </NavLink>
          </>
        )}
        <NavLink to="/tournois" className={linkCls} onClick={onNavigate}>
          <span aria-hidden>🏆</span>
          <span>Tournois</span>
        </NavLink>
        {!isTournamentOnly && (
          <NavLink to="/donnees" className={linkCls} onClick={onNavigate}>
            <span aria-hidden>{unlocked ? "🔓" : "🔒"}</span>
            <span>Données</span>
          </NavLink>
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-2 pb-5 mt-auto">
        <div className="sidebar-divider" />
        {!isTournamentOnly && onAddClick && (
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              onAddClick?.();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white text-sm font-semibold transition mb-1"
            style={{ background: "#dc2626" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#b91c1c")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#dc2626")}
          >
            <span aria-hidden>🏸</span>
            <span>Ajouter une raquette</span>
          </button>
        )}
        <button onClick={onLogout} className="sidebar-logout">
          <LogOut size={16} />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}

export default function TopNav({ unlocked, onAddClick, role }) {
  const isTournamentOnly = role === "tournament_only";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const sharedProps = {
    isTournamentOnly,
    unlocked,
    onAddClick,
    onLogout: handleLogout,
  };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="fixed left-0 top-0 bottom-0 hidden md:flex flex-col overflow-y-auto"
        style={{ width: 224, background: "#000000", zIndex: 40 }}
      >
        <SidebarContent {...sharedProps} onNavigate={() => {}} />
      </aside>

      {/* ── Mobile top bar ── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 flex items-center px-4"
        style={{ height: 56, background: "#000000", zIndex: 40 }}
      >
        <NavLink
          to={isTournamentOnly ? "/tournois" : "/suivi"}
          className="flex items-center gap-2"
          onClick={() => setMobileOpen(false)}
          style={{ textDecoration: "none" }}
        >
          <img src={sportminedorLogo} alt="" className="h-7 w-7 rounded-full select-none" />
          <span className="font-bold text-white">Sportminedor</span>
        </NavLink>
        <button
          type="button"
          className="ml-auto h-10 w-10 flex items-center justify-center rounded-md text-white"
          style={{ background: "none", border: "none" }}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileOpen}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
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
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0"
            style={{ background: "rgba(0,0,0,0.5)", zIndex: 50 }}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="md:hidden fixed left-0 top-0 bottom-0 flex flex-col overflow-y-auto"
            style={{ width: 224, background: "#000000", zIndex: 51 }}
          >
            <SidebarContent
              {...sharedProps}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}
    </>
  );
}
