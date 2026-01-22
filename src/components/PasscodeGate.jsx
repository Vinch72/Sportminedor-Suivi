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
    return (
      <div>
        <div className="mb-3">
          <button className="icon-btn" onClick={lock} title="Verrouiller la page">
            🔒 Verrouiller
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <form
        onSubmit={unlock}
        className="card p-5 max-w-sm w-full border rounded-2xl bg-white shadow-sm"
      >
        <div className="text-lg font-semibold mb-2">Accès restreint</div>
        <div className="text-sm text-gray-600 mb-3">
          Entrez le code pour accéder aux données.
        </div>
        <input
          type="password"
          className="input input-bordered w-full text-black bg-white"
          placeholder="Code"
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
        {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
        <button
          type="submit"
          className="btn-red mt-4 w-full rounded-xl text-white py-2"
          style={{ background: "#E10600" }}
        >
          Déverrouiller
        </button>
      </form>
    </div>
  );
}
