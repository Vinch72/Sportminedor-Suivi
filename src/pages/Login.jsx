import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

// Ajuste les chemins selon tes fichiers
import logo from "../assets/sportminedor-logo.png";
// Optionnel si tu ajoutes la mascotte en local
// import mascot from "../assets/sportminedor-mascot.png";

export default function Login() {
  const nav = useNavigate();
  const { signInWithPassword, session, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!loading && session) nav("/suivi", { replace: true });
  }, [session, loading, nav]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await signInWithPassword(email, password);
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
                Connectez-vous pour accéder à l’application.
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
