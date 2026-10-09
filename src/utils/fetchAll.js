// src/utils/fetchAll.js — charge TOUTES les lignes d'une requête, par paquets.
// Supabase renvoie au plus 1 000 lignes par requête : au-delà, les lignes
// suivantes étaient silencieusement absentes (ex. 1 332 clients → 1 000).
// `build` doit renvoyer une NOUVELLE requête à chaque appel, avec un tri stable
// (terminer par une colonne unique, ex. .order("id")).
const PAGE = 1000;

export async function fetchAll(build) {
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) return { data: all.length ? all : null, error };
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { data: all, error: null };
}
