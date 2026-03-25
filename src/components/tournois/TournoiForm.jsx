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
  const [optionsCordages, setOptionsCordages] = useState([]);
  const [selectedCordages, setSelectedCordages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [useBlue, setUseBlue] = useState(false);

  const { createOrUpdate, getCordeurs, getCordages } = useTournois();

  // sync quand on clique ✏️ depuis la liste
  useEffect(() => {
  setTournoi(initial?.tournoi || "");
  setStartDate(initial?.start_date || initial?.date || "");
  setEndDate(initial?.end_date || initial?.start_date || initial?.date || "");
  setInfos(initial?.infos || "");
  setUseBlue(!!initial?.use_blue);
}, [initial]);

  // options cordeurs + cordages
  useEffect(() => {
    supabase.from("cordeur").select("cordeur").then(({ data }) => {
      setOptionsCordeurs((data || []).map((x) => x.cordeur));
    });
    supabase.from("cordages").select("cordage, marque").order("marque", { nullsFirst: false }).order("cordage").then(({ data }) => {
      setOptionsCordages(data || []);
    });
  }, []);

  // coche les cordeurs + cordages existants en édition
  useEffect(() => {
    if (initial?.tournoi) {
      getCordeurs(initial.tournoi).then(setSelectedCordeurs);
      getCordages(initial.tournoi).then(setSelectedCordages);
    } else {
      setSelectedCordeurs([]);
      setSelectedCordages([]);
    }
  }, [initial?.tournoi, getCordeurs, getCordages]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createOrUpdate({
        initial,
        tournoi,
        start_date: startDate || null,
        end_date:   endDate   || null,
        date: startDate || null,
        infos,
        use_blue: useBlue,
        cordeurIdsOrNames: selectedCordeurs,
        cordageIds: selectedCordages,
      });
      onDone?.();
      // reset si création
      if (!isEditing) {
        setTournoi(""); setStartDate(""); setEndDate("");
        setInfos(""); setSelectedCordeurs([]); setSelectedCordages([]);
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
      <div className="grid gap-3">
        {/* Nom (prend 2 colonnes en md) */}
        <div>
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

        {/* Blue */}
<div className="flex items-center gap-3 mt-1">
  <input
    id="use_blue"
    type="checkbox"
    checked={useBlue}
    onChange={(e) => setUseBlue(e.target.checked)}
    className="h-4 w-4"
  />
  <label htmlFor="use_blue" className="text-sm font-medium text-gray-700">
    🔵 Utilisation de Blue
  </label>
</div>

        {/* Infos (2 colonnes) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Informations</label>
          <textarea
            className="mt-1 w-full border rounded-md px-3 py-2 h-24"
            value={infos}
            onChange={(e) => setInfos(e.target.value)}
          />
        </div>

        {/* Cordeurs */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Cordeurs</label>
          <div className="mt-1 border rounded-md px-2 py-1 max-h-28 overflow-auto">
            {optionsCordeurs.map((c) => (
              <label key={c} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCordeurs.includes(c)}
                  onChange={(e) =>
                    setSelectedCordeurs((prev) =>
                      e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)
                    )
                  }
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Cordages disponibles (filtrés dans le QR Code) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Cordages disponibles
            <span className="ml-1 text-xs font-normal text-gray-400">(visibles dans le QR Code)</span>
          </label>
          <div className="mt-1 border rounded-md px-2 py-1 max-h-36 overflow-auto">
            {optionsCordages.length === 0 && (
              <p className="text-xs text-gray-400 py-1">Aucun cordage trouvé</p>
            )}
            {(() => {
              const groups = {}; const order = [];
              optionsCordages.forEach(c => {
                const g = c.marque || "Autres";
                if (!groups[g]) { groups[g] = []; order.push(g); }
                groups[g].push(c.cordage);
              });
              if (order.length <= 1) return optionsCordages.map(c => (
                <label key={c.cordage} className="flex items-center gap-2 py-1 text-sm">
                  <input type="checkbox" checked={selectedCordages.includes(c.cordage)}
                    onChange={e => setSelectedCordages(prev => e.target.checked ? [...prev, c.cordage] : prev.filter(x => x !== c.cordage))} />
                  <span>{c.cordage}</span>
                </label>
              ));
              return order.map(g => (
                <div key={g}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1.5 pb-0.5">{g}</div>
                  {groups[g].map(name => (
                    <label key={name} className="flex items-center gap-2 py-1 text-sm">
                      <input type="checkbox" checked={selectedCordages.includes(name)}
                        onChange={e => setSelectedCordages(prev => e.target.checked ? [...prev, name] : prev.filter(x => x !== name))} />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              ));
            })()}
          </div>
          {selectedCordages.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">Si aucun coché → tous les cordages sont affichés.</p>
          )}
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
