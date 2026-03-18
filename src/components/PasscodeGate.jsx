// src/components/PasscodeGate.jsx
import { useEffect, useState } from "react";

const PASS =
  import.meta.env.VITE_DONNEES_CODE && String(import.meta.env.VITE_DONNEES_CODE);

export const DONNEES_UNLOCK_KEY = "donnees_ok_until"; // timestamp d’expiration
export function isDonneesUnlocked() {
  const t = Number(localStorage.getItem(DONNEES_UNLOCK_KEY) || "0");
  return t && Date.now() < t;
}

export default function PasscodeGate({ children, ttlHours = 12 }) {
  const [ok, setOk] = useState(false);
  const [v, setV] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = Number(localStorage.getItem(DONNEES_UNLOCK_KEY) || "0");
    if (t && Date.now() < t) setOk(true);
  }, []);

  function unlock(e) {
    e.preventDefault();
    const expected = PASS || "CHANGE_ME"; // fallback si pas d’ENV
    if (v.trim() === expected) {
      setOk(true);
      setErr("");
      localStorage.setItem(
        DONNEES_UNLOCK_KEY,
        String(Date.now() + ttlHours * 60 * 60 * 1000)
      );
    } else {
      setErr("Code incorrect.");
    }
  }

  function lock() {
    localStorage.removeItem(DONNEES_UNLOCK_KEY);
    setOk(false);
    setV("");
  }

  if (ok) {
    // Render prop : si children est une fonction, on lui passe { lock }
    if (typeof children === "function") return children({ lock });
    return <div>{children}</div>;
  }

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] md:min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(800px 500px at 30% 20%, rgba(225,6,0,0.07), transparent 60%), " +
          "radial-gradient(600px 400px at 80% 70%, rgba(225,6,0,0.04), transparent 55%), " +
          "linear-gradient(180deg, #f8f8f8 0%, #f1f1f1 100%)",
      }}
    >
      <form
        onSubmit={unlock}
        className="w-full max-w-sm"
        style={{
          background: "rgba(255,255,255,0.95)",
          borderRadius: 20,
          padding: 28,
          boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {/* Icône cadenas */}
        <div className="flex justify-center mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "rgba(225,6,0,0.08)" }}
          >
            🔐
          </div>
        </div>

        <div className="text-center mb-5">
          <div className="text-lg font-bold text-gray-900">Accès restreint</div>
          <div className="text-sm text-gray-400 mt-1">
            Entrez le code pour accéder aux données.
          </div>
        </div>

        <input
          type="password"
          className="input-field text-center text-lg tracking-widest"
          placeholder="• • • • • •"
          value={v}
          onChange={(e) => setV(e.target.value)}
          autoFocus
        />

        {err && (
          <div className="mt-2 text-sm text-red-500 text-center">{err}</div>
        )}

        <button
          type="submit"
          className="mt-4 w-full py-2.5 rounded-xl text-white font-bold text-sm transition"
          style={{
            background: "linear-gradient(180deg, #ff2b2b 0%, #c80000 100%)",
            boxShadow: "0 8px 20px rgba(200,0,0,0.25)",
          }}
        >
          Déverrouiller
        </button>

      </form>
    </div>
  );
}
