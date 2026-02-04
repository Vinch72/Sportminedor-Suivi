export function computeGainCordeur({
  fourni,
  tarifCents,
  gainCentsFromCordage,
}) {
  if (fourni === true) {
    if (tarifCents === 1200) return 1000;
    if (tarifCents === 1400) return 1166;
  }

  return gainCentsFromCordage ?? 0;
}
