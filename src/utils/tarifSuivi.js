// src/utils/tarifSuivi.js — tarif d'une raquette du suivi (même règle que SuiviForm)
const U = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();

// club = { clubs, bobine_base, bobine_specific } ; cordage = { is_base }
// Renvoie un prix en euros, ou null si on ne peut pas le déterminer.
export function calcTarifSuivi({ club, cordage, fourni = false, offert = false, express = false, expressCents = 400 }) {
  let base = null;
  if (offert) base = 0;
  else if (fourni) base = 12;
  else {
    if (!club || !cordage) return null;
    const isBase  = !!cordage.is_base;
    const hasBase = !!club.bobine_base;
    const hasSpec = !!club.bobine_specific;
    if (!hasBase && !hasSpec)      base = isBase ? 18 : 20;
    else if (hasBase && !hasSpec)  base = isBase ? 12 : 20;
    else if (hasBase && hasSpec) {
      // Exception FABREGUES : bobine spécifique = 12 €
      if (U(club.clubs) === "FABREGUES" && !isBase) base = 12;
      else base = isBase ? 12 : 14;
    }
    // bobine spécifique seule : pas de règle (comme SuiviForm) → null
  }
  if (base != null && express) base += expressCents / 100;
  return base;
}

// Bobine du club utilisée pour ce cordage : "base" | "specific" | "none"
export function bobineUsed({ club, cordage, fourni = false }) {
  if (fourni || !club || !cordage) return "none";
  if (cordage.is_base && club.bobine_base) return "base";
  if (!cordage.is_base && club.bobine_specific) return "specific";
  return "none";
}
