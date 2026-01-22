// src/components/ui/CenteredModal.jsx
import React from "react";

export default function CenteredModal({
  open,
  onClose,
  title = "Merci !",
  icon = "🎾",
  children,
  confirmLabel = "OK",
  dark = false, // ⬅️ active le thème noir
}) {
  if (!open) return null;

  const cardCls = dark
    ? "bg-[#111] text-white border-zinc-800"
    : "bg-white text-gray-900 border-gray-200";

  const subtleText = dark ? "text-zinc-300" : "text-gray-600";
  const closeBtn   = dark ? "text-zinc-400 hover:text-white" : "text-gray-500 hover:text-gray-800";
  const backdrop   = dark ? "bg-black/60" : "bg-black/50";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      {/* Backdrop */}
      <div className={`absolute inset-0 ${backdrop} backdrop-blur-[1px]`} onClick={onClose} aria-hidden />

      {/* Card */}
      <div className={`relative w-[min(92vw,520px)] rounded-2xl shadow-2xl border ${cardCls} animate-[pop_.18s_ease-out]`}>
        <div className="p-5 flex items-start gap-3">
          <div className="text-3xl leading-none select-none">{icon}</div>
          <div className="min-w-0 flex-1">
            <div id="modal-title" className="text-lg font-semibold">{title}</div>
            <div className={`mt-1 text-sm ${subtleText}`}>{children}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-md ${closeBtn}`}
            aria-label="Fermer"
            title="Fermer"
          >
            ✖
          </button>
        </div>

        <div className="px-5 pb-5 pt-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-white"
            style={{ background: "#E10600" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pop { from { transform: scale(.96); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
}
