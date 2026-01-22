// src/components/tournois/TournoiForm.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useTournois } from "../../hooks/useTournois";

export default function TournoiForm({ initial, onDone }) {
  const isEditing = !!initial;

  // states
  const [tournoi, setTournoi] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [infos, setInfos] = useState("");
  const [optionsCordeurs, setOptionsCordeurs] = useState([]);
  const [selectedCordeurs, setSelectedCordeurs] = useState([]);
  const [saving, setSaving] = useState(false);

  const { createOrUpdate, getCordeurs } = useTournois();

  // sync quand on clique ✏️ depuis la liste
  useEffect(() => {
    setTournoi(initial?.tournoi || "");
    setStartDate(initial?.start_date || initial?.date || "");
    setEndDate(initial?.end_date || initial?.start_date || initial?.date || "");
    setInfos(initial?.infos || "");
  }, [initial]);

  // options cordeurs
  useEffect(() => {
    supabase.from("cordeur").select("cordeur").then(({ data }) => {
      setOptionsCordeurs((data || []).map((x) => x.cordeur));
    });
  }, []);

  // coche les cordeurs existants en édition
  useEffect(() => {
    if (initial?.tournoi) {
      getCordeurs(initial.tournoi).then(setSelectedCordeurs);
    } else {
      setSelectedCordeurs([]);
    }
  }, [initial?.tournoi, getCordeurs]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createOrUpdate({
        initial,
        tournoi,
        start_date: startDate || null,
        end_date:   endDate   || null,
        // (optionnel pour compat avec anciens champs)
        date: startDate || null,
        infos,
        cordeurIdsOrNames: selectedCordeurs,
      });
      onDone?.();
      // reset si création
      if (!isEditing) {
        setTournoi(""); setStartDate(""); setEndDate("");
        setInfos(""); setSelectedCordeurs([]);
      }
    } catch (err) {
      console.error(err);
      alert(err?.message || "Erreur enregistrement tournoi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200"
    >
      {/* layout compact: 4 colonnes dès md */}
      <div className="grid gap-3 md:grid-cols-4">
        {/* Nom (prend 2 colonnes en md) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            Nom du tournoi
          </label>
          <input
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={tournoi}
            onChange={(e) => setTournoi(e.target.value)}
            required
          />
        </div>

        {/* Début */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Début</label>
          <input
            type="date"
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={startDate || ""}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {/* Fin */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Fin</label>
          <input
            type="date"
            className="mt-1 w-full border rounded-md px-3 py-2"
            value={endDate || ""}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Infos (2 colonnes) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Informations</label>
          <textarea
            className="mt-1 w-full border rounded-md px-3 py-2 h-24"
            value={infos}
            onChange={(e) => setInfos(e.target.value)}
          />
        </div>

        {/* Cordeurs (2 colonnes, compact) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Cordeurs</label>
          <div className="mt-1 border rounded-md px-2 py-1 max-h-28 overflow-auto">
            {optionsCordeurs.map((c) => (
              <label key={c} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCordeurs.includes(c)}
                  onChange={(e) =>
                    setSelectedCordeurs((prev) =>
                      e.target.checked
                        ? [...prev, c]
                        : prev.filter((x) => x !== c)
                    )
                  }
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          disabled={saving}
          className="btn-red px-4 py-2 rounded-xl text-white focus:ring-2 focus:ring-offset-2 focus:ring-[#E10600]"
          style={{ background: "#E10600" }}
        >
          {isEditing ? "Mettre à jour" : "Créer le tournoi"}
        </button>
      </div>
    </form>
  );
}
