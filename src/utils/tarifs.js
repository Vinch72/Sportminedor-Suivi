/**
 * Calcule le tarif en centimes selon les options sélectionnées
 * @param {Object} options - Les options de tarification
 * @param {boolean} options.isBase - Si c'est une option de base
 * @param {boolean} options.bobineBase - Si la bobine de base est incluse
 * @param {boolean} options.bobineSpecific - Si une bobine spécifique est incluse
 * @param {boolean} options.fourni - Si l'article est fourni par le client
 * @param {boolean} options.offert - Si l'article est offert
 * @returns {number} Le tarif en centimes
 */
export function computeTarifCents({ isBase, bobineBase, bobineSpecific, fourni, offert }) {
  if (offert) return 0;            // 0 €
  if (fourni) return 1200;         // 12 €
  if (bobineBase && bobineSpecific) return isBase ? 1200 : 1400;
  if (bobineBase && !bobineSpecific) return isBase ? 1200 : 2000;
  return isBase ? 1800 : 2000;
}

/**
 * Convertit un montant en centimes en texte au format euro
 * @param {number} cents - Le montant en centimes
 * @returns {string} Le montant formaté en euros (ex: "12 €")
 */
export function toEuroText(cents) {
  return `${(cents / 100).toFixed(0)} €`;
}
