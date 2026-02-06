// src/utils/gains.js

const U = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();

export function parseMoneyToCents(v) {
  if (v == null) return 0;
  const s = String(v).replace(/\s/g, "");
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return 0;
  const euros = parseFloat(m[0].replace(",", "."));
  return Math.round(euros * 100);
}

// cordagesById : { [cordageName]: { gain_magasin_cents: number, ... } }
export function computeGainMagasinCents(row, cordagesById) {
  const regMode = U(row?.reglement_mode);
  const offert = !!row?.offert || regMode === "OFFERT";

  if (offert) return 500;

  const tarifCents = parseMoneyToCents(row?.tarif);
  const fourni = !!row?.fourni;
  const bobine = U(row?.bobine_used); // "BASE" | "SPECIFIC" | "NONE"

  // Exceptions
  if (fourni && tarifCents === 1200) return 500;
  if (bobine === "BASE" && tarifCents === 1200) return 500;
  if (bobine === "SPECIFIC" && tarifCents === 1400) return 580;

  // Fallback table cordages
  const cordage = row?.cordage_id;
  const ref = cordagesById?.[cordage];
  return Number(ref?.gain_magasin_cents ?? 0) || 0;
}
