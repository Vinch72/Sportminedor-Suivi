import { useEffect, useRef } from "react";

/**
 * Bouton "Précédent" universel.
 * - Essaie d'abord history.back()
 * - Si rien ne se passe (pas d'historique dans l'onglet), redirige vers le fallback (ex: "/sportminedor")
 */
export default function BackButton({
  className = "icon-btn",
  label = "Précédent",
  fallbackPath = "/sportminedor",
}) {
  const lastPathRef = useRef("");

  useEffect(() => {
    lastPathRef.current = window.location.pathname + window.location.search + window.location.hash;
  }, []);

  const goBack = () => {
    const before = window.location.pathname + window.location.search + window.location.hash;

    // Tente un "vrai" retour navigateur
    window.history.back();

    // Après un court délai, si l'URL n'a pas bougé, on force la redirection
    setTimeout(() => {
      const after = window.location.pathname + window.location.search + window.location.hash;
      if (after === before) {
        // Pas de page précédente → on va sur le fallback (Sportminedor)
        window.location.assign(fallbackPath);
      }
    }, 300);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className={className}
      aria-label={label}
      title={label}
    >
      ←
    </button>
  );
}