// Trie les cordages par marque puis par nom
export function sortCordages(cordages) {
  return [...cordages].sort((a, b) => {
    const ma = (a.marque || "zzz").toLowerCase();
    const mb = (b.marque || "zzz").toLowerCase();
    if (ma !== mb) return ma.localeCompare(mb, "fr");
    return (a.cordage || "").localeCompare(b.cordage || "", "fr");
  });
}

// Groupe les cordages par marque pour les selects natifs (<optgroup>)
export function groupCordagesByMarque(cordages) {
  const groups = {};
  const order = [];
  sortCordages(cordages).forEach(c => {
    const g = c.marque || "Autres";
    if (!groups[g]) { groups[g] = []; order.push(g); }
    groups[g].push(c);
  });
  return order.map(g => ({ marque: g, items: groups[g] }));
}
