// src/components/tournois/TournoiDetailModal.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import TournoiRacketForm from "./TournoiRacketForm";
import TournoiRacketsTable from "./TournoiRacketsTable";
import NewClientInline from "./NewClientInline";
import { useTournoiRackets } from "../../hooks/useTournoiRackets";
import logo from "../../assets/sportminedor-logo.png";
import ConfirmModal from "../ui/ConfirmModal";
import Toast from "../ui/Toast";
import { computeGainCordeur } from "../../utils/computeGainCordeur";

function parseD(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + "T00:00:00");
  const d = new Date(v);
  return isNaN(+d) ? null : d;
}
function fmt(d) { return d ? d.toLocaleDateString("fr-FR") : "—"; }
function rangeLabel(row) {
  if (!row) return "—";
  const start = parseD(row.start_date || row.date);
  const end = parseD(row.end_date || row.start_date || row.date);
  if (!start && !end) return "—";
  if (start && end && +start !== +end) return `Du ${fmt(start)} au ${fmt(end)}`;
  return `Le ${fmt(start || end)}`;
}

export default function TournoiDetailModal({ tournoi, onClose, onOpenVentes }) {
  const initialName = typeof tournoi === "string" ? tournoi : tournoi?.tournoi;
  const [fresh, setFresh] = useState(typeof tournoi === "object" && tournoi ? tournoi : null);
  const tournoiName = fresh?.tournoi || initialName || "Tournoi";

  const [cordeurs, setCordeurs] = useState([]);
  const [prefillClientId, setPrefillClientId] = useState(null);
  const [showInfos, setShowInfos] = useState(false);
  const [showRacketForm, setShowRacketForm] = useState(false);
  const [showCordagesManager, setShowCordagesManager] = useState(false);

  const [allCordages, setAllCordages] = useState([]);
  const [selectedCordages, setSelectedCordages] = useState([]);
  const [savingCordages, setSavingCordages] = useState(false);

  const { rows: rackets, priceForRow, clubFlagsForRow, load } = useTournoiRackets(tournoiName);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("info");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    title: "Confirmer", message: "", icon: "⚠️",
    confirmLabel: "Confirmer", cancelLabel: "Annuler", danger: false,
  });
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    if (!tournoi) return;
    let mounted = true;
    async function loadTournament() {
      if (!initialName) return;
      const { data, error } = await supabase.from("tournois").select("*").eq("tournoi", initialName).maybeSingle();
      if (!mounted) return;
      if (!error && data) setFresh(data);
    }
    async function loadCordeurs() {
      if (!initialName) return;
      const { data } = await supabase.from("tournoi_cordeurs").select("cordeur").eq("tournoi", initialName);
      if (!mounted) return;
      setCordeurs((data || []).map((d) => d.cordeur));
    }
    async function loadCordages() {
      const [rAll, rLinked] = await Promise.all([
        supabase.from("cordages").select("cordage, marque").order("marque", { nullsFirst: false }).order("cordage"),
        supabase.from("tournoi_cordages").select("cordage_id").eq("tournoi", initialName),
      ]);
      if (!mounted) return;
      setAllCordages(rAll.data || []);
      setSelectedCordages((rLinked.data || []).map(c => c.cordage_id));
    }
    loadTournament();
    loadCordeurs();
    loadCordages();
    const onUpdated = () => { loadTournament(); loadCordeurs(); };
    window.addEventListener("tournois:updated", onUpdated);
    return () => { mounted = false; window.removeEventListener("tournois:updated", onUpdated); };
  }, [initialName, tournoi]);

  // Ouvre automatiquement le formulaire raquette quand un client vient d'être créé
  useEffect(() => {
    if (prefillClientId) setShowRacketForm(true);
  }, [prefillClientId]);

  async function saveCordages() {
    setSavingCordages(true);
    try {
      await supabase.from("tournoi_cordages").delete().eq("tournoi", tournoiName);
      if (selectedCordages.length > 0) {
        await supabase.from("tournoi_cordages").insert(
          selectedCordages.map(c => ({ tournoi: tournoiName, cordage_id: c }))
        );
      }
    } finally {
      setSavingCordages(false);
    }
  }

  if (!tournoi) return null;

  function showToast(title, message = "", variant = "info") {
    setToastTitle(title); setToastMessage(message); setToastVariant(variant); setToastOpen(true);
  }
  function askConfirm(config, action) {
    setConfirmConfig({
      title: config?.title ?? "Confirmer", message: config?.message ?? "",
      icon: config?.icon ?? "⚠️", confirmLabel: config?.confirmLabel ?? "Confirmer",
      cancelLabel: config?.cancelLabel ?? "Annuler", danger: !!config?.danger,
    });
    setConfirmAction(() => action);
    setConfirmOpen(true);
  }


  return (
    <>
      <div className="fixed inset-0 modal-overlay z-50" onClick={onClose}>
        <div className="absolute inset-0 bg-white overflow-y-auto" onClick={(e) => e.stopPropagation()}>

          {/* Header sticky */}
          <div className="sticky top-0 bg-white border-b z-10 px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <img src={logo} alt="" className="h-7 w-7 rounded-full select-none shrink-0" />
                <div className="min-w-0">
                  <div className="text-xl font-semibold truncate">{tournoiName}</div>
                  <div className="text-sm text-gray-500">
                    {rangeLabel(fresh)}{cordeurs.length ? ` • ${cordeurs.join(" • ")}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="icon-btn" title={showInfos ? "Masquer les infos" : "Afficher les infos"} onClick={() => setShowInfos((s) => !s)}>ℹ️</button>
                <button className="icon-btn" title="Fermer" onClick={onClose}>✖</button>
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            {/* Infos */}
            {showInfos && (
              <div>
                <button className="text-[#E10600] underline text-sm" onClick={() => setShowInfos(false)}>Masquer les infos</button>
                <div className="mt-2 whitespace-pre-wrap border rounded-xl p-3 text-sm">{fresh?.infos || "—"}</div>
              </div>
            )}
            {!showInfos && (
              <button className="text-[#E10600] underline text-sm" onClick={() => setShowInfos(true)}>Afficher les infos</button>
            )}

            {/* Accordéons */}
            <div className="space-y-2">
            <NewClientInline onCreated={(id) => setPrefillClientId(id)} />

            {/* Accordéon : Ajouter une raquette */}
            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRacketForm((o) => !o)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition"
              >
                <span className="text-base leading-none">🏸</span>
                <span className="font-medium text-sm flex-1">Ajouter une raquette</span>
                <span className="text-gray-400 text-xs">{showRacketForm ? "▲" : "▼"}</span>
              </button>
              {showRacketForm && (
                <div className="border-t border-gray-100 px-4 py-4">
                  <TournoiRacketForm tournoiName={tournoiName} allowedCordeurs={cordeurs} prefillClientId={prefillClientId} />
                </div>
              )}
            </div>

            {/* Accordéon : Cordages disponibles */}
            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCordagesManager(o => !o)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition"
              >
                <span className="text-base leading-none">🧵</span>
                <span className="font-medium text-sm flex-1">Gérer mes cordages disponibles sur le tournoi</span>
                <span className="text-gray-400 text-xs">{showCordagesManager ? "▲" : "▼"}</span>
              </button>
              {showCordagesManager && (
                <div className="border-t border-gray-100 px-4 py-4">
                  <p className="text-xs text-gray-500 mb-3">
                    Coche les cordages disponibles. Le QR Code n'affichera que ceux-là.
                    {selectedCordages.length === 0 && " Si aucun coché → tous les cordages sont affichés."}
                  </p>
                  <div className="max-h-48 overflow-auto">
                    {(() => {
                      const groups = {}; const order = [];
                      allCordages.forEach(c => {
                        const g = c.marque || "Autres";
                        if (!groups[g]) { groups[g] = []; order.push(g); }
                        groups[g].push(c.cordage);
                      });
                      if (order.length <= 1) return (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {allCordages.map(c => (
                            <label key={c.cordage} className="flex items-center gap-2 text-sm py-0.5">
                              <input type="checkbox" checked={selectedCordages.includes(c.cordage)}
                                onChange={e => setSelectedCordages(prev => e.target.checked ? [...prev, c.cordage] : prev.filter(x => x !== c.cordage))} />
                              <span>{c.cordage}</span>
                            </label>
                          ))}
                        </div>
                      );
                      return order.map(g => (
                        <div key={g} className="mb-2">
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-0.5 mb-1">{g}</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            {groups[g].map(name => (
                              <label key={name} className="flex items-center gap-2 text-sm py-0.5">
                                <input type="checkbox" checked={selectedCordages.includes(name)}
                                  onChange={e => setSelectedCordages(prev => e.target.checked ? [...prev, name] : prev.filter(x => x !== name))} />
                                <span>{name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <button
                    type="button"
                    disabled={savingCordages}
                    onClick={saveCordages}
                    className="mt-4 btn-red px-4 py-2 rounded-xl text-white text-sm"
                  >
                    {savingCordages ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              )}
            </div>
            </div>{/* fin accordéons */}

            {/* Suivi du tournoi */}
            <TournoiRacketsTable
              tournoiName={tournoiName}
              onOpenVentes={() => onOpenVentes?.(tournoi)}
            />
          </div>

          <ConfirmModal
            open={confirmOpen}
            title={confirmConfig.title}
            message={confirmConfig.message}
            icon={confirmConfig.icon}
            confirmLabel={confirmConfig.confirmLabel}
            cancelLabel={confirmConfig.cancelLabel}
            danger={confirmConfig.danger}
            onCancel={() => { setConfirmOpen(false); setConfirmAction(null); }}
            onConfirm={async () => {
              setConfirmOpen(false);
              const fn = confirmAction;
              setConfirmAction(null);
              await fn?.();
            }}
          />
          <Toast open={toastOpen} onClose={() => setToastOpen(false)} title={toastTitle} message={toastMessage} variant={toastVariant} />
        </div>
      </div>

    </>
  );
}