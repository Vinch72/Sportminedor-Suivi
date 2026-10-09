// src/utils/cordages.js — infos cordage (jauges 0-5 + note), comme Stringflow
export const CORDAGE_INFO_COLS = "info_controle, info_puissance, info_durabilite, info_note";

export const CORDAGE_INFO_FIELDS = [
  { key: "info_controle",   label: "Contrôle" },
  { key: "info_puissance",  label: "Puissance" },
  { key: "info_durabilite", label: "Durabilité" },
];

export const hasCordageInfo = (c) =>
  !!c && !!(c.info_controle || c.info_puissance || c.info_durabilite || c.info_note);
