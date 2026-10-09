// Libellé affiché d'une raquette (table raquettes) : "MARQUE MODÈLE"
export const raquetteLabel = (r) => [r?.brand, r?.model].filter(Boolean).join(" ");
