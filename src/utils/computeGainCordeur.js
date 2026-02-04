export function computeGainCordeur({
  fourni,
  tarifEur,
  gainCentsSnapshot,
  gainFromCordageEur,
  ruleGain12Eur = 10,
  ruleGain14Eur = 11.66,
}) {
  // 1) Snapshot figé (tournoi verrouillé)
  if (Number.isFinite(gainCentsSnapshot)) {
    return gainCentsSnapshot / 100;
  }

  // 2) RÈGLES FIXES PAR TARIF (prioritaires sur le gain cordage)
  if (Math.abs((tarifEur || 0) - 12) < 0.01) return ruleGain12Eur;   // bobine base / fourni
  if (Math.abs((tarifEur || 0) - 14) < 0.01) return ruleGain14Eur;   // bobine spécifique

  // 3) Lookup cordage
  if (Number.isFinite(gainFromCordageEur)) {
    return gainFromCordageEur;
  }

  // 4) Fallback
  return 0;
}
