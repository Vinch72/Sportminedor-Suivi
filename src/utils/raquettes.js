// src/utils/raquettes.js — table raquettes (raquettes enregistrées des clients)
import { supabase } from "./supabaseClient";

// Libellé affiché d'une raquette : "MARQUE MODÈLE"
export const raquetteLabel = (r) => [r?.brand, r?.model].filter(Boolean).join(" ");

// Raquettes d'un client (liste vide si erreur : jamais bloquant)
export async function fetchClientRaquettes(clientId) {
  if (!clientId) return [];
  const { data, error } = await supabase.from("raquettes")
    .select("id, brand, model, pref_cordage_id, pref_tension")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return error ? [] : (data || []);
}

// Raquette à lier : sélectionnée, sinon même libellé chez le client, sinon
// créée à partir du texte saisi. Renvoie { id, created } ; id = null si échec.
export async function resolveRaquette({ clientId, text, selectedId, list = [], cordageId, tension }) {
  const txt = (text || "").trim().toUpperCase();
  if (!clientId || !txt) return { id: null, created: null };
  if (selectedId) return { id: selectedId, created: null };
  const same = list.find(r => raquetteLabel(r).toUpperCase() === txt || (r.model || "").toUpperCase() === txt);
  if (same) return { id: same.id, created: null };
  try {
    const row = { client_id: clientId, model: txt, pref_cordage_id: cordageId || null, pref_tension: tension || null };
    const { data, error } = await supabase.from("raquettes").insert(row).select("id").single();
    if (error) throw error;
    return { id: data.id, created: { ...row, id: data.id, brand: null } };
  } catch (e) {
    console.warn("Création raquette ignorée:", e);
    return { id: null, created: null };
  }
}

// "Enregistrer pour les futurs cordages" : mémorise cordage/tension sur la raquette
export async function saveRaquettePrefs(id, { cordageId, tension }) {
  if (!id) return;
  const { error } = await supabase.from("raquettes")
    .update({ pref_cordage_id: cordageId || null, pref_tension: tension || null })
    .eq("id", id);
  if (error) console.warn("Maj préférences raquette ignorée:", error);
}
