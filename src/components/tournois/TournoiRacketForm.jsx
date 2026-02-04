  // src/components/tournois/TournoiRacketForm.jsx
  import { useEffect, useMemo, useState } from "react";
  import { supabase } from "../../utils/supabaseClient";
  import ComboBox from "../ui/ComboBox";
  import CenteredModal from "../ui/CenteredModal";

  export default function TournoiRacketForm({
    tournoiName,
    allowedCordeurs = [],
    prefillClientId,
    editingId = null,
    initialData = null,
    onDone,
  }) {
    const [savePrefs, setSavePrefs] = useState(false);
    const [clients, setClients] = useState([]);
    const [cordages, setCordages] = useState([]);
    const [clubs, setClubs] = useState([]);
    const [cordeurs, setCordeurs] = useState([]);
    const [statuts, setStatuts] = useState([]);
    const [tarifMatrix, setTarifMatrix] = useState([]);
    const [saving, setSaving] = useState(false);
    const [thanksOpen, setThanksOpen] = useState(false);
    const [form, setForm] = useState({
      date: new Date().toISOString().slice(0, 10),
      client_id: "",
      cordage_id: "",
      tension: "",
      cordeur_id: "",
      statut_id: "",
      raquette: "",
      club_id: "",
      fourni: false,
      offert: false,
      qty: 1,
    });

    useEffect(() => {
    if (!editingId || !initialData) return;

    setForm({
      date: (initialData.date || new Date().toISOString().slice(0, 10)).slice(0,10),
      client_id: initialData.client_id || "",
      cordage_id: initialData.cordage_id || initialData?.cordage?.cordage || "",
      tension: initialData.tension || "",
      cordeur_id: initialData.cordeur_id || initialData?.cordeur?.cordeur || "",
      statut_id: initialData.statut_id || "",
      raquette: initialData.raquette || "",
      club_id: initialData.club_id || "",
      fourni: !!initialData.fourni,
      offert: !!initialData.offert,
      qty: 1,
    });
  }, [editingId, initialData]);

  const [count, setCount] = useState(1);

    // ------- Lookups -------
    const loadLookups = async () => {
      const [c, co, s, cr, cl, tc, tm] = await Promise.all([
        supabase.from("clients").select("id, nom, prenom, tension, cordage, club").order("nom"),
        supabase.from("cordages").select("cordage, is_base, Couleur").order("cordage"),
        supabase.from("statuts").select("statut_id"),
        supabase.from("cordeur").select("cordeur").order("cordeur"),
        supabase.from("clubs").select("clubs, bobine_base, bobine_specific").order("clubs"),
        supabase.from("tournoi_cordeurs").select("cordeur").eq("tournoi", tournoiName),
        supabase.from("tarif_matrix").select("*"),
      ]);
      if (c.error) console.error("clients", c.error);
      if (co.error) console.error("cordages", co.error);
      if (s.error) console.error("statuts", s.error);
      if (cr.error) console.error("cordeur", cr.error);
      if (cl.error) console.error("clubs", cl.error);
      if (tm.error) console.error("tarif_matrix", tm.error);

      setClients(c.data || []);
      setCordages(co.data || []);
      setStatuts(s.data || []);
      setTarifMatrix(tm.data || []);
      setClubs(cl.data || []);

      const norm = (x) => (x || "").toString().trim().toLowerCase();

const tournoiCordeurs = tc?.data || [];
const allowedSet = new Set(tournoiCordeurs.map(x => norm(x.cordeur)));

if (allowedSet.size === 0) {
  // aucun cordeur lié au tournoi → on affiche TOUS
  setCordeurs(cr.data || []);
} else {
  setCordeurs(
    (cr.data || []).filter(c => allowedSet.has(norm(c.cordeur)))
  );
}
    };

    useEffect(() => {
      loadLookups();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournoiName, JSON.stringify(allowedCordeurs)]);

    // Pré-sélection si nouveau client créé juste avant
    useEffect(() => {
      if (!prefillClientId) return;
      const cli = clients.find((x) => x.id === prefillClientId);
      if (cli) {
        setForm((f) => ({
          ...f,
          client_id: cli.id,
          cordage_id: cli.cordage || f.cordage_id,
          tension: cli.tension || f.tension,
          club_id: cli.club || f.club_id,
        }));
      }
    }, [prefillClientId, clients]);

    // Recharger quand la liste clients change ailleurs
    useEffect(() => {
      const onClientsUpdated = () => loadLookups();
      window.addEventListener("clients:updated", onClientsUpdated);
      return () => window.removeEventListener("clients:updated", onClientsUpdated);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onClient = (id) => {
      const cli = clients.find((x) => x.id === id);
      setForm((f) => ({
        ...f,
        client_id: id || "",
        cordage_id: cli?.cordage || f.cordage_id,
        tension: cli?.tension || f.tension,
        club_id: cli?.club || f.club_id,
      }));
    };

    // ------- Tarif auto (affiché) -------
    const U = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();

    const priceEuros = useMemo(() => {
  if (form.offert) return 0;
  if (form.fourni) return 12;

  const club = clubs.find((c) => c.clubs === form.club_id);
  const cordage = cordages.find((co) => co.cordage === form.cordage_id);
  if (!club || !cordage) return null;

  // ✅ FABREGUES : spécifique = 12€
  if (U(club.clubs) === "FABREGUES" && club.bobine_base && club.bobine_specific && cordage.is_base === false) {
    return 12;
  }

  const row = tarifMatrix.find(
    (r) =>
      (!!r.bobine_base) === !!club.bobine_base &&
      (!!r.bobine_specific) === !!club.bobine_specific &&
      (!!r.is_base) === !!cordage.is_base
  );
  return row ? (row.price_cents || 0) / 100 : null;
}, [form.offert, form.fourni, form.club_id, form.cordage_id, clubs, cordages, tarifMatrix]);

    // ------- Submit -------
    const submit = async (e) => {
      e.preventDefault();
      setSaving(true);
      try {
        const todayISO = new Date().toISOString().slice(0, 10);
        const dateISO = (form.date || (editingId ? initialData?.date : null) || todayISO).slice(0,10);

        const payload = {
          tournoi: tournoiName,
          client_id: form.client_id || null,
          cordage_id: form.cordage_id || null, // texte (cordages.cordage)
          tension: form.tension || null,
          cordeur_id: form.cordeur_id || null,
          statut_id: form.statut_id || null,
          raquette: form.raquette || null,
          club_id: form.club_id || null,       // texte (clubs.clubs)
          fourni: !!form.fourni,
          offert: !!form.offert,
          date: dateISO,
        };
        // ... dans submit(), partie "else" (création)
const qty = Math.max(1, Number(count || 1));

const payloads = Array.from({ length: qty }, () => ({
  tournoi: tournoiName,
  client_id: form.client_id || null,
  cordage_id: form.cordage_id || null,
  tension: form.tension || null,
  cordeur_id: form.cordeur_id || null,
  statut_id: form.statut_id || null,
  raquette: form.raquette || null,
  club_id: form.club_id || null,
  fourni: !!form.fourni,
  offert: !!form.offert,
  date: dateISO,
}));

const { data: inserted, error } = await supabase
  .from("tournoi_raquettes")
  .insert(payloads)
  .select("id, statut_id, reglement_mode");

if (error) throw error;

const insertedIds = inserted.map(r => r.id);

        // --- Sauvegarde des préférences client si demandé (cordage/tension) ---
        try {
          if (savePrefs && form.client_id) {
            await supabase
              .from("clients")
              .update({
                cordage: form.cordage_id || null,
          tension: form.tension || null,
          // (facultatif) club aussi si tu veux qu’il suive :
          // club: form.club_id || null,
        })
        .eq("id", form.client_id);

        // informer le reste de l’app que la fiche client a changé
        window.dispatchEvent(new CustomEvent("clients:updated", { detail: { id: form.client_id }}));
      }
    } catch (e) {
      console.warn("Maj préférences client (tournoi) ignorée:", e);
    }

       window.dispatchEvent(
  new CustomEvent("tournoi:raquette:created", {
    detail: {
      tournoi: tournoiName,
      ids: insertedIds, // ⬅️ LE LOT COMPLET
    },
  })
);

  if (editingId) {
    if (onDone) await onDone();
    return;
  }
        
        setThanksOpen(true);
        setForm({
          date: new Date().toISOString().slice(0, 10),
          client_id: "",
          cordage_id: "",
          tension: "",
          cordeur_id: "",
          statut_id: "",
          raquette: "",
          club_id: "",
          fourni: false,
          offert: false,
          qty: 1,
        });
      } catch (err) {
        console.error(err);
        alert(err.message || "Erreur ajout raquette");
      } finally {
        setSaving(false);
      }
    };

    

    // ------- Items ComboBox -------
    const clientItems  = useMemo(() => clients.map((c) => ({ value: c.id,      label: `${c.nom} ${c.prenom}`.trim() })), [clients]);
    const cordageItems = useMemo(() => cordages.map((co) => ({ value: co.cordage, label: co.Couleur && co.Couleur !== "none" ? `● ${co.cordage}` : co.cordage })), [cordages]);
    const clubItems    = useMemo(() => (clubs || []).map((cl) => ({ value: cl.clubs, label: cl.clubs })), [clubs]);
    const cordeurItems = useMemo(() => (cordeurs || []).map((c) => ({ value: c.cordeur, label: c.cordeur })), [cordeurs]);
    const statutItems  = useMemo(() => (statuts || []).map((s) => ({ value: s.statut_id, label: s.statut_id })), [statuts]);

    // ------- UI -------
    return (
      <form onSubmit={submit} className="bg-white rounded-2xl p-3 border">
        <div className="grid md:grid-cols-3 gap-2">
          <div>
  <label className="text-sm">Nombre de raquettes</label>
  <input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  value={count}
  onChange={(e) => {
    const v = e.target.value.replace(/\D/g, "");
    setCount(v === "" ? "" : Math.max(1, Math.min(20, Number(v))));
  }}
  onBlur={() => {
    if (!count || Number(count) < 1) setCount(1);
  }}
  placeholder="1"
  className="w-full h-11 rounded-xl border px-3 text-base text-gray-900 placeholder:text-gray-400"
/>
  <div className="text-xs text-gray-500 mt-1">
    (Duplique la saisie à l’identique)
  </div>
</div>

          <div>
  <label className="text-sm">Date</label>
  <input
    type="date"
    className="border rounded-md px-3 py-2 w-full"
    value={form.date || ""}
    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
  />
</div>

          <div>
            <label className="text-sm">Client</label>
            <ComboBox
              items={clientItems}
              value={form.client_id || null}
              onChange={(v) => onClient(v)}
              placeholder="Tapez un nom…"
            />
          </div>

          <div>
            <label className="text-sm">Cordage</label>
            <ComboBox
              items={cordageItems}
              value={form.cordage_id || null}
              onChange={(v) => setForm((f) => ({ ...f, cordage_id: v || "" }))}
              placeholder="Rechercher un cordage…"
            />
          </div>

          <div>
            <label className="text-sm">Tension</label>
            <input
              className="border rounded-md px-3 py-2 w-full"
              value={form.tension}
              onChange={(e) => setForm((f) => ({ ...f, tension: e.target.value }))}
            />
          </div>

          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={savePrefs}
              onChange={(e) => setSavePrefs(e.target.checked)}
            />
            <span>Enregistrer pour les futurs cordages (met à jour la fiche client)</span>
          </label>

          <div>
            <label className="text-sm">Cordeur</label>
            <ComboBox
              items={cordeurItems}
              value={form.cordeur_id || null}
              onChange={(v) => setForm((f) => ({ ...f, cordeur_id: v || "" }))}
              placeholder="Choisir le cordeur…"
            />
          </div>

          <div>
            <label className="text-sm">Statut</label>
            <ComboBox
              items={statutItems}
              value={form.statut_id || null}
              onChange={(v) => setForm((f) => ({ ...f, statut_id: v || "" }))}
              placeholder="Choisir un statut…"
            />
          </div>

          <div>
            <label className="text-sm">Raquette</label>
            <input
              className="border rounded-md px-3 py-2 w-full"
              value={form.raquette}
              onChange={(e) => setForm((f) => ({ ...f, raquette: e.target.value }))}
              placeholder="Ex: Pure Drive, Pro Staff…"
            />
          </div>

          <div>
            <label className="text-sm">Club</label>
            <ComboBox
              items={clubItems}
              value={form.club_id || null}
              onChange={(v) => setForm((f) => ({ ...f, club_id: v || "" }))}
              placeholder="Rechercher un club…"
              allowCustom={true}
            />
          </div>

          {/* Fourni / Offert (mutuellement exclusifs) */}
          <div className="md:col-span-3 flex items-center gap-6 mt-1">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.fourni}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fourni: e.target.checked, ...(e.target.checked ? { offert: false } : {}) }))
                }
              />
              <span>Fourni</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.offert}
                onChange={(e) =>
                  setForm((f) => ({ ...f, offert: e.target.checked, ...(e.target.checked ? { fourni: false } : {}) }))
                }
              />
              <span>Offert</span>
            </label>

            <div className="text-sm text-gray-600">
              Tarif estimé : <b>{priceEuros === null ? "—" : `${priceEuros.toFixed(0)} €`}</b>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <button className="btn-red focus:ring-2 focus:ring-offset-2 focus:ring-[#E10600]" disabled={saving}>
            Ajouter
          </button>

          <CenteredModal
            open={thanksOpen}
            onClose={() => setThanksOpen(false)}
            title="Merci de nous avoir confié ta raquette 🙌"
            icon="🎾"
          >
            N’oublie pas de la <b>décorder</b> ! Le cordeur va faire au plus vite.
          </CenteredModal>
        </div>
      </form>
    );
  }