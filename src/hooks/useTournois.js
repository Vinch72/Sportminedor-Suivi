// src/hooks/useTournois.js
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const DUPLICATE_MSG = "Un tournoi avec ce nom existe déjà.";

// small helpers
const parseDate = (v) => {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + "T00:00:00");
  const d = new Date(v);
  return isNaN(+d) ? null : d;
};

export function useTournois() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  /** Charge la liste (vue qui exclut “Magasin”) – tolérant aux colonnes */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1) On ne sélectionne pas de colonnes spécifiques (compatible toutes versions)
      const { data, error } = await supabase.from("tournois_list").select("*");
      if (error) throw error;

      const list = Array.isArray(data) ? data.slice() : [];

      // 2) Tri côté client par (start_date || date), puis nom
      list.sort((a, b) => {
        const ad =
          parseDate(a.start_date || a.date) || new Date(8640000000000000);
        const bd =
          parseDate(b.start_date || b.date) || new Date(8640000000000000);
        if (ad.getTime() !== bd.getTime()) return ad - bd;
        return String(a.tournoi || "").localeCompare(String(b.tournoi || ""), "fr");
      });

      setItems(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const onU = () => fetchAll();
    window.addEventListener("tournois:updated", onU);
    return () => window.removeEventListener("tournois:updated", onU);
  }, [fetchAll]);

  /**
   * Crée ou met à jour un tournoi + ses cordeurs
   * @param {{initial?: {tournoi:string, start_date?:string, end_date?:string, date?:string, infos?:string}, tournoi:string, start_date?:string, end_date?:string, date?:string, infos?:string, cordeurIdsOrNames?: string[]}} params
   */
  const createOrUpdate = useCallback(
    async ({ initial, tournoi, start_date, end_date, date, infos, cordeurIdsOrNames }) => {
      if (!tournoi) throw new Error("Nom du tournoi requis");

      // Normalisation: tolère l'ancien champ 'date'
      const payload = {
        tournoi,
        start_date: start_date || date || null,
        end_date: end_date || start_date || date || null,
        infos: infos || null,
      };

      // Si renommage → vérifie unicité
      if (initial && tournoi !== initial.tournoi) {
        const { data: exists, error: exErr } = await supabase
          .from("tournois")
          .select("tournoi")
          .eq("tournoi", tournoi)
          .maybeSingle();
        if (exErr) throw exErr;
        if (exists) throw new Error(DUPLICATE_MSG);
      }

      // Création / mise à jour
      if (!initial) {
        const { error } = await supabase.from("tournois").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tournois")
          .update(payload)
          .eq("tournoi", initial.tournoi);
        if (error) throw error;

        // Supprime les anciens liens (couvre aussi le cas renommage)
        const { error: delErr } = await supabase
          .from("tournoi_cordeurs")
          .delete()
          .in("tournoi", [initial.tournoi, tournoi]);
        if (delErr) throw delErr;
      }

      // (Ré)insère les liens cordeurs
      const clean = (cordeurIdsOrNames || []).filter(Boolean);
      if (clean.length) {
        const rows = clean.map((c) => ({ tournoi, cordeur: c }));
        const { error: linkErr } = await supabase
          .from("tournoi_cordeurs")
          .upsert(rows, { onConflict: "tournoi,cordeur" });
        if (linkErr) throw linkErr;
      }

      window.dispatchEvent(new CustomEvent("tournois:updated"));
    },
    []
  );

  /** Supprime un tournoi par son nom (clé texte) */
  const remove = useCallback(async (tournoiName) => {
    const { error } = await supabase
      .from("tournois")
      .delete()
      .eq("tournoi", tournoiName);
    if (error) throw error;
    window.dispatchEvent(new CustomEvent("tournois:updated"));
  }, []);

  /** Récupère la liste des cordeurs (array de strings) pour un tournoi */
  const getCordeurs = useCallback(async (tournoiName) => {
    const { data, error } = await supabase
      .from("tournoi_cordeurs")
      .select("cordeur")
      .eq("tournoi", tournoiName);
    if (error) throw error;
    return (data || []).map((r) => r.cordeur);
  }, []);

  return {
    loading,
    items,
    fetchAll,
    createOrUpdate,
    remove,
    getCordeurs,
  };
}