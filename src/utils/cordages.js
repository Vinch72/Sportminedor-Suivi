// src/utils/cordages.js — infos cordage (jauges 0-5 + note), comme Stringflow
export const CORDAGE_INFO_COLS = "info_controle, info_puissance, info_durabilite, info_note";

export const CORDAGE_INFO_FIELDS = [
  { key: "info_controle",   label: "Contrôle" },
  { key: "info_puissance",  label: "Puissance" },
  { key: "info_durabilite", label: "Durabilité" },
];

export const hasCordageInfo = (c) =>
  !!c && !!(c.info_controle || c.info_puissance || c.info_durabilite || c.info_note);

// Raquette de tournoi : objet "cordage" reconstruit depuis les colonnes figées
// de la ligne (nom + basique/spécifique), indépendant de la table cordages
export const withCordageSnapshot = (r) => ({
  ...r,
  cordage: r.cordage_id ? { cordage: r.cordage_id, is_base: r.cordage_is_base } : null,
});
