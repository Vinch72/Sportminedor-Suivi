// src/components/tournois/NewClientInline.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import ComboBox from "../ui/ComboBox";

export default function NewClientInline({ onCreated }) {
  const [cordages, setCordages] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    nom: "",
    prenom: "",
    tension: "",
    cordage: "",
    club: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    (async () => {
      const [co, cl] = await Promise.all([
        supabase.from("cordages").select("cordage, Couleur").order("cordage"),
        supabase.from("clubs").select("clubs").order("clubs"),
      ]);
      if (!co.error) setCordages(co.data || []);
      if (!cl.error) setClubs(cl.data || []);
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.nom || !f.prenom) return alert("Nom et prénom requis.");
    setSaving(true);
    try {
      const payload = {
        nom: f.nom.trim(),
        prenom: f.prenom.trim(),
        tension: f.tension || null,
        cordage: f.cordage || null, // TEXT
        club: f.club || null,       // TEXT
        phone: f.phone || null,
        email: f.email || null,
      };
      const { data, error } = await supabase
        .from("clients")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      window.dispatchEvent(new CustomEvent("clients:updated"));
      onCreated?.(data?.id);
      setF({
        nom: "",
        prenom: "",
        tension: "",
        cordage: "",
        club: "",
        phone: "",
        email: "",
      });
    } catch (e2) {
      console.error(e2);
      alert(e2.message || "Erreur ajout client");
    } finally {
      setSaving(false);
    }
  };

  const cordageItems = useMemo(
    () =>
      (cordages || []).map((co) => ({
        value: co.cordage,
        label: co.Couleur && co.Couleur !== "none" ? `● ${co.cordage}` : co.cordage,
      })),
    [cordages]
  );

  const clubItems = useMemo(
    () => (clubs || []).map((cl) => ({ value: cl.clubs, label: cl.clubs })),
    [clubs]
  );

  return (
    <div className="card p-3">
      <div className="font-semibold mb-2">Ajouter un nouveau client</div>
      <form onSubmit={submit} className="grid md:grid-cols-3 gap-2">
        <div>
          <label className="text-sm">Nom *</label>
          <input
            className="border rounded-md px-3 py-2 w-full"
            value={f.nom}
            onChange={(e) => setF((s) => ({ ...s, nom: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm">Prénom *</label>
          <input
            className="border rounded-md px-3 py-2 w-full"
            value={f.prenom}
            onChange={(e) => setF((s) => ({ ...s, prenom: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm">Tension</label>
          <input
            className="border rounded-md px-3 py-2 w-full"
            placeholder="ex: 11-11,5"
            value={f.tension}
            onChange={(e) => setF((s) => ({ ...s, tension: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-sm">Cordage</label>
          <ComboBox
            items={cordageItems}
            value={f.cordage || null}
            onChange={(v) => setF((s) => ({ ...s, cordage: v || "" }))}
            placeholder="Rechercher un cordage…"
          />
        </div>

        <div>
          <label className="text-sm">Club</label>
          <ComboBox
            items={clubItems}
            value={f.club || null}
            onChange={(v) => setF((s) => ({ ...s, club: v || "" }))}
            placeholder="Rechercher un club…"
            allowCustom={true}
          />
        </div>

        <div>
          <label className="text-sm">Téléphone</label>
          <input
            className="border rounded-md px-3 py-2 w-full"
            value={f.phone}
            onChange={(e) => setF((s) => ({ ...s, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm">Email</label>
          <input
            className="border rounded-md px-3 py-2 w-full"
            value={f.email}
            onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))}
          />
        </div>

        <div className="md:col-span-3 mt-2">
          <button
            className="btn-red focus:ring-2 focus:ring-offset-2 focus:ring-[#E10600]"
            disabled={saving}
          >
            Ajouter le client
          </button>
        </div>
      </form>
    </div>
  );
}
