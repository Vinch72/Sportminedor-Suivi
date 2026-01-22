import { useEffect } from "react";

export default function Toast({
  open,
  onClose,
  title = "Merci !",
  message = "",
  variant = "info",        // "success" | "info" | "warning"
  duration = 3500,
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  if (!open) return null;

  const styles = {
    success: { bar: "bg-green-500", icon: "✅" },
    info:    { bar: "bg-blue-500",  icon: "ℹ️" },
    warning: { bar: "bg-amber-500", icon: "⚠️" },
  }[variant];

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] select-none"
      role="status"
      aria-live="polite"
    >
      <div
        className="
          relative flex items-start gap-3
          rounded-2xl bg-white shadow-2xl border border-gray-200
          px-4 py-3 w-[min(92vw,420px)]
          animate-[toastIn_.25s_ease-out]
        "
        style={{
          // petite barre de couleur à gauche
          boxShadow: "0 10px 25px rgba(0,0,0,.12)",
        }}
      >
        <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${styles.bar}`} />
        <div className="text-xl leading-none">{styles.icon}</div>
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-gray-600">{message}</div>
        </div>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="ml-auto text-gray-500 hover:text-gray-800 rounded-md p-1"
          aria-label="Fermer"
          title="Fermer"
        >
          ✖
        </button>
      </div>

      {/* petite animation via keyframes inline-tailwind */}
      <style>{`
        @keyframes toastIn {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);  opacity: 1; }
        }
      `}</style>
    </div>
  );
}
