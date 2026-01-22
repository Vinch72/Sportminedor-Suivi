// src/utils/payment.js

export function normalize(s = "") {
    return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().trim();
  }
  
  /**
   * Convertit n'importe quelle saisie en valeur ASCII stockée:
   *   CB | Especes | Cheque | Virement
   */
  export function toCanonical(input) {
    const n = normalize(input);
  
    // CB
    if (n === "CB" || n === "CARTE" || n === "CARTEBANCAIRE" || n === "CARTE BLEUE")
      return "CB";
  
    // ESPECES
    if (n === "ESPECES" || n === "ESPECE" || n === "CASH")
      return "Especes";
  
    // CHEQUE — accepter plein de variantes
    if (
      n === "CHEQUE" || n === "CHEQ" || n === "CHQ" || n === "CH" ||
      n === "CHEQUEBANCAIRE" || n === "CHEK" || n === "CHECK" // au cas où
    )
      return "Cheque";
  
    // VIREMENT
    if (n === "VIREMENT" || n === "VIR" || n === "SEPA")
      return "Virement";
  
    return null;
  }
  
  /**
   * Affichage (emoji + label humanisé) depuis la valeur stockée
   * (accentuée OU ASCII)
   */
  export function paymentMeta(modeRaw) {
    const n = normalize(modeRaw || "");
    if (n === "CB")       return { emoji: "💳", label: "CB" };
    if (n === "ESPECES")  return { emoji: "💶", label: "Espèces" };
    if (n === "CHEQUE")   return { emoji: "🧾", label: "Chèque" };
    if (n === "VIREMENT") return { emoji: "🔁", label: "Virement" };
    return { emoji: "—", label: "—" };
  }
  
  export const PAYMENT_STORAGE_VALUES = ["CB", "Especes", "Cheque", "Virement"];
  