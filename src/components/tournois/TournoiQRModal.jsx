// src/components/tournois/TournoiQRModal.jsx
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

const BASE_URL = "https://sportminedor-suivi.vercel.app";
const RED = "#E10600";

export default function TournoiQRModal({ tournoi, onClose }) {
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    return `${BASE_URL}/tournoi?t=${encodeURIComponent(tournoi?.tournoi || "")}`;
  }, [tournoi]);

  // ✅ lock scroll behind modal
  useEffect(() => {
    if (!tournoi) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // évite le "jump" dû à la disparition de la scrollbar
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [tournoi]);

  useEffect(() => {
    if (!tournoi) return;
    QRCode.toDataURL(url, {
      width: 360,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setDataUrl);
  }, [url, tournoi]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function downloadQR() {
    if (!dataUrl || !tournoi?.tournoi) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${tournoi.tournoi.replace(/\s+/g, "_")}.png`;
    a.click();
  }

  if (!tournoi) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 p-4 flex items-center justify-center"
      onMouseDown={onClose}
      // empêche le scroll chain vers la page derrière (navigateurs modernes)
      style={{ overscrollBehavior: "contain" }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-base text-gray-900">
                QR Code — <span className="font-bold">{tournoi.tournoi}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              aria-label="Fermer"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ✅ Scroll area */}
        <div
          className="px-5 py-4 overflow-y-auto"
          // hauteur contrôlée : scroll à l’intérieur
          style={{ maxHeight: "70vh", overscrollBehavior: "contain" }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {/* URL + copy */}
          <div className="w-full rounded-xl border bg-gray-50 px-3 py-2 flex items-center gap-3">
            <div className="min-w-0 flex-1 font-mono text-[11px] text-gray-600 break-all">
              {url}
            </div>
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {copied ? "Copié ✅" : "Copier"}
            </button>
          </div>

          {/* QR (plus petit) */}
          <div className="mt-4 flex justify-center">
            <div className="rounded-2xl border shadow-sm bg-white p-3">
              {dataUrl ? (
                <img src={dataUrl} alt="QR Code" className="w-48 h-48 rounded-xl" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-gray-300 text-sm">
                  Génération…
                </div>
              )}
            </div>
          </div>

          {/* How-to */}
          <div
            className="mt-4 rounded-2xl border px-4 py-4"
            style={{
              background: "rgba(225, 6, 0, 0.06)",
              borderColor: "rgba(225, 6, 0, 0.18)",
            }}
          >
            <div className="flex items-center gap-2 font-semibold" style={{ color: RED }}>
              <span aria-hidden>📋</span>
              <span>Comment l&apos;utiliser</span>
            </div>
            <ol className="mt-3 space-y-2 text-sm" style={{ color: "rgba(225, 6, 0, 0.95)" }}>
              <li>1. Télécharge le QR code</li>
              <li>2. Imprime-le (A5 ou A4) et plastifie-le</li>
              <li>3. Pose-le sur ton stand de cordage</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-0">
          <button
            type="button"
            onClick={downloadQR}
            disabled={!dataUrl}
            className="w-full h-12 rounded-xl text-white font-semibold disabled:opacity-40 transition flex items-center justify-center gap-2"
            style={{ background: RED }}
          >
            <span aria-hidden>⬇️</span>
            Télécharger le QR code
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full h-11 rounded-xl border font-medium text-gray-700 hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}