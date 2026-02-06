export function computeGainCordeur({
  fourni,
  offert,              // ✅ AJOUT
  tarifEur,
  gainCentsSnapshot,
  gainFromCordageEur,
  ruleGain12Eur = 10,
  ruleGain14Eur = 11.66,
  ruleOffertEur = 11,  // ✅ AJOUT (optionnel)
}) {
  // 1) Snapshot figé (tournoi verrouillé)
  if (Number.isFinite(gainCentsSnapshot)) {
    return gainCentsSnapshot / 100;
  }

  // 2) ✅ OFFERT (prioritaire sur toutes les règles)
  if (offert === true) {
    return ruleOffertEur; // 11€
  }

  // 3) RÈGLES FIXES PAR TARIF (prioritaires sur le gain cordage)
  if (Math.abs((tarifEur || 0) - 12) < 0.01) return ruleGain12Eur;
  if (Math.abs((tarifEur || 0) - 14) < 0.01) return ruleGain14Eur;

  // 4) Lookup cordage
  if (Number.isFinite(gainFromCordageEur)) {
    return gainFromCordageEur;
  }

  // 5) Fallback
  return 0;
}
