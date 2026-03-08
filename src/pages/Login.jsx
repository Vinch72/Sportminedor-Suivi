import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

// Ajuste les chemins selon tes fichiers
import logo from "../assets/sportminedor-logo.png";
// Optionnel si tu ajoutes la mascotte en local
// import mascot from "../assets/sportminedor-mascot.png";

function getContextualMessage() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=dim, 1=lun, 2=mar, ..., 6=sam

  // Matin
  if (hour >= 6 && hour < 12) {
    if (day === 0) return "😴 Dimanche matin ? Même l'app se repose le dimanche... App by Vinch 🫡";
    if (day === 1) return "🛋️ Lundi, jour off ! T'as oublié que t'es pas censé bosser ?";
    if (day === 2) return "☕ Mardi matin, c'est reparti ! La semaine commence, les raquettes aussi.";
    if (day === 6) return "🏁 Samedi matin, dernier jour ! On finit en beauté 💪";
    return "🌅 Bonne matinée ! Les raquettes vont pas se corder toutes seules...";
  }
  // Après-midi
  if (hour >= 12 && hour < 18) {
    if (day === 0) return "☀️ Dimanche aprèm, repos total ! Pourquoi t'es là toi ?";
    if (day === 1) return "🛋️ Lundi aprèm, profite ! Demain ça repart.";
    if (day === 3) return "🐪 Mercredi, mi-semaine ! La descente commence, tiens bon.";
    if (day === 5) return "🍾 Vendredi aprèm, avant-dernière ligne droite. Presque le week-end !";
    if (day === 6) return "🏆 Samedi aprèm, la fin approche ! Encore quelques raquettes et c'est plié.";
    return "⚡ Après-midi productive en vue. Les cordages t'attendent !";
  }
  // Soirée
  if (hour >= 18 && hour < 22) {
    if (day === 6) return "🎊 Samedi soir, semaine terminée ! T'as mérité ton week-end. GG 🫡";
    if (day === 2) return "🌙 Mardi soir, bonne première journée ! Vinch est fier de toi.";
    if (day === 5) return "🌆 Vendredi soir boulot ? Dévoué(e) ! Demain c'est le dernier.";
    return "🌆 Soirée boulot ? Respect. App made with ❤️ by Vinch";
  }
  // Nuit
  if (hour >= 22 || hour < 6) {
    return "🦉 Tu cogites la nuit ? L'app est là 24h/24 mais toi t'as besoin de dormir 😄";
  }

  return "👋 Bienvenue sur Sportminedor Suivi App !";
}

export default function Login() {
  const nav = useNavigate();
  const { signInWithPassword, session, loading } = useAuth();

  const safeStorage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, val); } catch {} },
    remove(key) { try { localStorage.removeItem(key); } catch {} },
  };

  const [email, setEmail] = useState(() => safeStorage.get("sm_saved_email") || "");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [rememberMe, setRememberMe] = useState(() => safeStorage.get("sm_remember_email") === "1");
  useEffect(() => {
    if (!loading && session) nav("/suivi", { replace: true });
  }, [session, loading, nav]);

  async function onSubmit(e) {
  e.preventDefault();
  setMsg(null);
  try {
    await signInWithPassword(email, password);
    if (rememberMe) {
      safeStorage.set("sm_remember_email", "1");
      safeStorage.set("sm_saved_email", email);
    } else {
      safeStorage.remove("sm_remember_email");
      safeStorage.remove("sm_saved_email");
    }
    nav("/suivi", { replace: true });
  } catch (err) {
    setMsg(err.message);
  }
}

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background:
          "radial-gradient(900px 500px at 20% 10%, rgba(255,0,0,0.18), transparent 60%), radial-gradient(700px 400px at 80% 20%, rgba(255,0,0,0.10), transparent 55%), linear-gradient(180deg, #0b0b0f 0%, #050507 100%)",
      }}
    >
      {/* petit “halo” rouge derrière la carte */}
      <div style={{ width: "100%", maxWidth: 440, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            inset: -10,
            background:
              "radial-gradient(240px 140px at 35% 0%, rgba(255,0,0,0.35), transparent 60%)",
            filter: "blur(12px)",
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(255,255,255,0.96)",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {/* Header marque */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={logo}
              alt="Sportminedor"
              style={{ height: 100, width: "auto" }}
            />

            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>
                Suivi Cordage & Tournois
              </div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                {getContextualMessage()}
              </div>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <form onSubmit={onSubmit}>
            <label style={{ fontSize: 13, color: "#333", fontWeight: 600 }}>
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="prenom.nom@sportminedor.com"
              style={{
                width: "100%",
                padding: "11px 12px",
                marginTop: 7,
                marginBottom: 14,
                borderRadius: 12,
                border: "1px solid #ddd",
                outline: "none",
              }}
            />

            <label style={{ fontSize: 13, color: "#333", fontWeight: 600 }}>
              Mot de passe
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "11px 12px",
                marginTop: 7,
                marginBottom: 16,
                borderRadius: 12,
                border: "1px solid #ddd",
                outline: "none",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
  <input
    id="remember-cb"
    type="checkbox"
    checked={rememberMe}
    onChange={e => setRememberMe(e.target.checked)}
    style={{ width: 15, height: 15, accentColor: "#c80000", cursor: "pointer" }}
  />
  <label htmlFor="remember-cb" style={{ fontSize: 13, color: "#333", cursor: "pointer", userSelect: "none" }}>
    Mémoriser mon email
  </label>
</div>

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(180deg, #ff2b2b 0%, #c80000 100%)",
                color: "white",
                cursor: "pointer",
                fontWeight: 800,
                letterSpacing: 0.2,
                boxShadow: "0 10px 20px rgba(200,0,0,0.25)",
              }}
            >
              Se connecter
            </button>

            {msg && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: "#ffecec",
                  color: "#a40000",
                  fontSize: 14,
                  border: "1px solid rgba(164,0,0,0.15)",
                }}
              >
                {msg}
              </div>
            )}
          </form>

          <div
            style={{
              marginTop: 16,
              fontSize: 12,
              color: "#777",
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span>Sportminedor • Accès interne</span>
            <span style={{ color: "#999" }}>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
