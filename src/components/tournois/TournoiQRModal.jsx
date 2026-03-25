// src/components/tournois/TournoiQRModal.jsx
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import logoUrl from "../../assets/sportminedor-logo.png";

const BASE_URL = "https://sportminedor-suivi.vercel.app";
const RED = "#E10600";

function formatDate(val) {
  if (!val) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Date(val).toLocaleDateString("fr-FR");
}

function buildDateLabel(t) {
  const sd = formatDate(t?.start_date);
  const ed = formatDate(t?.end_date);
  const d  = formatDate(t?.date);
  if (sd && ed && sd !== ed) return `${sd} → ${ed}`;
  return sd || ed || d || null;
}

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

  function printQR() {
    if (!dataUrl || !tournoi?.tournoi) return;
    const nom   = tournoi.tournoi;
    const dates = buildDateLabel(tournoi);
    const absLogo = new URL(logoUrl, window.location.origin).href;

    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>QR Code — ${nom}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .card {
      width: 100%;
      max-width: 480px;
      background: white;
      border: 2px solid #E10600;
      border-radius: 20px;
      padding: 40px 36px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.10);
    }
    .logo { width: 150px; margin-bottom: 22px; }
    .divider {
      width: 48px; height: 4px;
      background: #E10600;
      border-radius: 2px;
      margin: 0 auto 20px;
    }
    .tournament-name {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
      letter-spacing: -0.3px;
    }
    .tournament-date {
      font-size: 14px;
      color: #64748b;
      font-weight: 500;
      margin-bottom: 28px;
    }
    .qr-wrap {
      display: inline-flex;
      padding: 14px;
      border-radius: 16px;
      border: 1.5px solid #e2e8f0;
      background: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.07);
      margin-bottom: 28px;
    }
    .qr-wrap img { width: 220px; height: 220px; display: block; border-radius: 8px; }
    .instruction {
      background: rgba(225, 6, 0, 0.05);
      border: 1.5px solid rgba(225, 6, 0, 0.18);
      border-radius: 14px;
      padding: 18px 20px;
      text-align: left;
    }
    .instruction-title {
      font-size: 14px;
      font-weight: 700;
      color: #E10600;
      margin-bottom: 10px;
    }
    .instruction ol { padding-left: 18px; }
    .instruction li {
      font-size: 13px;
      color: #374151;
      line-height: 1.7;
    }
    .footer {
      margin-top: 22px;
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body { background: white; padding: 0; }
      .card { box-shadow: none; border: 2px solid #E10600; }
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${absLogo}" alt="Sportminedor" class="logo" />
    <div class="divider"></div>
    <div class="tournament-name">${nom}</div>
    ${dates ? `<div class="tournament-date">📅 ${dates}</div>` : ""}
    <div class="qr-wrap">
      <img src="${dataUrl}" alt="QR Code" />
    </div>
    <div class="instruction">
      <div class="instruction-title">📲 Comment déposer ma raquette ?</div>
      <ol>
        <li>Ouvre l'appareil photo de ton téléphone</li>
        <li>Pointe-le vers ce QR code</li>
        <li>Appuie sur le lien qui apparaît</li>
        <li>Remplis le formulaire de dépôt</li>
      </ol>
    </div>
    <div class="footer">sportminedor-suivi.vercel.app</div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
    win.document.close();
  }

  if (!tournoi) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] modal-overlay p-4 flex items-center justify-center"
      onMouseDown={onClose}
      // empêche le scroll chain vers la page derrière (navigateurs modernes)
      style={{ overscrollBehavior: "contain" }}
    >
      <div
        className="w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        style={{ maxWidth: 580 }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: "rgba(225,6,0,0.08)" }}>
                📲
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base leading-tight">QR Code</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate" style={{ maxWidth: 300 }}>{tournoi.tournoi}</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-full border flex items-center justify-center text-gray-500 hover:bg-gray-50 shrink-0 mt-0.5" aria-label="Fermer" type="button">✕</button>
          </div>
        </div>

        {/* Corps — scroll sur mobile si besoin */}
        <div className="px-5 pt-4 pb-5 overflow-y-auto" style={{ maxHeight: "75vh" }}>
          {/* URL + copy */}
          <div className="w-full rounded-xl border bg-gray-50 px-3 py-2 flex items-center gap-3 mb-4">
            <div className="min-w-0 flex-1 font-mono text-[11px] text-gray-600 break-all">{url}</div>
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {copied ? "Copié ✅" : "Copier"}
            </button>
          </div>

          {/* Mobile : colonne unique — Desktop : côte à côte */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* QR code centré sur mobile */}
            <div className="flex justify-center sm:block w-full sm:w-auto">
              <div className="shrink-0 rounded-2xl border shadow-sm bg-white p-3">
                {dataUrl ? (
                  <img src={dataUrl} alt="QR Code" className="rounded-xl" style={{ width: 176, height: 176 }} />
                ) : (
                  <div className="flex items-center justify-center text-gray-300 text-sm" style={{ width: 176, height: 176 }}>
                    Génération…
                  </div>
                )}
              </div>
            </div>

            {/* How-to + boutons */}
            <div className="flex-1 w-full flex flex-col gap-3">
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ background: "rgba(225,6,0,0.06)", borderColor: "rgba(225,6,0,0.18)" }}
              >
                <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: RED }}>
                  <span aria-hidden>📋</span>
                  <span>Comment l&apos;utiliser</span>
                </div>
                <ol className="mt-2 space-y-1 text-sm" style={{ color: "rgba(225,6,0,0.9)" }}>
                  <li>1. Télécharge le QR code</li>
                  <li>2. Imprime-le (A5 ou A4) et plastifie-le</li>
                  <li>3. Pose-le sur ton stand de cordage</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={printQR}
                disabled={!dataUrl}
                className="w-full h-11 rounded-xl text-white font-semibold disabled:opacity-40 transition flex items-center justify-center gap-2"
                style={{ background: RED }}
              >
                <span aria-hidden>🖨️</span>
                Imprimer
              </button>
              <button
                type="button"
                onClick={downloadQR}
                disabled={!dataUrl}
                className="w-full h-10 rounded-xl border font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <span aria-hidden>⬇️</span>
                Télécharger
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 rounded-xl border font-medium text-gray-700 hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}