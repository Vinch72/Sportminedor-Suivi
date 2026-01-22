import { create } from "zustand";
import { supabase } from "../utils/supabaseClient";
import { computeTarifCents, toEuroText } from "../utils/tarifs";

export const useSuiviStore = create((set, get) => ({
  clubs: [],
  cordages: [],
  clients: [],
  cordeurs: [],
  loading: false,

  async boot() {
    set({ loading: true });
    const [
      { data: clubs },
      { data: cordages },
      { data: clients },
      { data: cordeurs }
    ] = await Promise.all([
      supabase.from("clubs").select("clubs, bobine_base, bobine_specific").order("clubs"),
      supabase.from("cordages").select("cordage, is_base").order("cordage"),
      supabase.from("clients").select("id, client_id").order("client_id"),
      supabase.from("cordeur").select("cordeur").order("cordeur"),
    ]);
    set({ 
      clubs: clubs || [], 
      cordages: cordages || [], 
      clients: clients || [], 
      cordeurs: cordeurs || [], 
      loading: false 
    });
  },

  async addSuivi({ client_id, club_id, cordage_id, fourni, offert, tension, couleur, cordeur }) {
    const cl = get().clubs.find(c => c.clubs === club_id);
    const co = get().cordages.find(x => x.cordage === cordage_id);
    const cents = computeTarifCents({
      isBase: !!co?.is_base,
      bobineBase: !!cl?.bobine_base,
      bobineSpecific: !!cl?.bobine_specific,
      fourni: !!fourni,
      offert: !!offert,
    });
    const tarifText = toEuroText(cents);

    const { error } = await supabase.from("suivi").insert([{
      client_id, 
      club_id, 
      cordage_id,
      fourni, 
      offert, 
      tension,
      couleur: couleur || "none",
      "Cordeur_id": cordeur || null,
      tarif: tarifText
    }]);
    
    if (error) throw error;
  },
}));
