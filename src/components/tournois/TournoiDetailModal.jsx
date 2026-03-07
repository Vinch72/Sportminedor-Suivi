// src/components/tournois/TournoiDetailModal.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import TournoiRacketForm from "./TournoiRacketForm";
import TournoiRacketsTable from "./TournoiRacketsTable";
import TournoiVentesModal from "./TournoiVentesModal";
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

export default function TournoiDetailModal({ tournoi, onClose }) {
  const initialName = typeof tournoi === "string" ? tournoi : tournoi?.tournoi;
  const [fresh, setFresh] = useState(typeof tournoi === "object" && tournoi ? tournoi : null);
  const tournoiName = fresh?.tournoi || initialName || "Tournoi";

  const [cordeurs, setCordeurs] = useState([]);
  const [prefillClientId, setPrefillClientId] = useState(null);
  const [showInfos, setShowInfos] = useState(true);
  const [showVentesModal, setShowVentesModal] = useState(false);

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
    loadTournament();
    loadCordeurs();
    const onUpdated = () => { loadTournament(); loadCordeurs(); };
    window.addEventListener("tournois:updated", onUpdated);
    return () => { mounted = false; window.removeEventListener("tournois:updated", onUpdated); };
  }, [initialName, tournoi]);

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

  async function unlockTournament() {
    askConfirm(
      { title: "Déverrouiller ce tournoi ?", message: "Les gains figés restent enregistrés.", icon: "🔓", confirmLabel: "Déverrouiller", cancelLabel: "Annuler", danger: false },
      async () => {
        try {
          const { error } = await supabase.from("tournois").update({ locked: false, locked_at: null }).eq("tournoi", tournoiName);
          if (error) throw error;
          const { data: freshRow } = await supabase.from("tournois").select("*").eq("tournoi", tournoiName).maybeSingle();
          if (freshRow) setFresh(freshRow);
          window.dispatchEvent(new Event("tournois:updated"));
        } catch (e) { showToast("Erreur", e?.message || "Échec du déverrouillage", "warning"); }
      }
    );
  }

  async function finalizeTournament() {
    askConfirm(
      { title: "Verrouiller le tournoi ?", message: "Figer tous les gains et verrouiller ?", icon: "🔒", confirmLabel: "Verrouiller", cancelLabel: "Annuler", danger: true },
      async () => {
        try {
          const norm = (s) => (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
          const toFreeze = (rackets || []).filter((r) => norm(r.statut_id) !== "A FAIRE" && r.gain_cents == null);
          const { data: cords, error: e2 } = await supabase.from("cordages").select("cordage, gain_cents");
          if (e2) throw e2;
          const gainMap = new Map((cords || []).map((c) => [(c.cordage || "").toString().trim().toUpperCase(), Number.isInteger(c.gain_cents) ? c.gain_cents : 0]));
          const [{ data: f12 }, { data: f14 }] = await Promise.all([
            supabase.from("app_settings").select("*").eq("key", "fourni_gain_12_cents").maybeSingle(),
            supabase.from("app_settings").select("*").eq("key", "fourni_gain_14_cents").maybeSingle(),
          ]);
          const fourni12GainEur = (f12?.value_cents ?? 1000) / 100;
          const fourni14GainEur = (f14?.value_cents ?? 1166) / 100;
          for (const r of toFreeze) {
            const key = (r.cordage_id || "").toString().trim().toUpperCase();
            const gainEur = computeGainCordeur({
              offert: !!r.offert, fourni: !!r.fourni, tarifEur: priceForRow(r),
              ...clubFlagsForRow(r), gainCentsSnapshot: null,
              gainFromCordageEur: (gainMap.get(key) ?? 0) / 100,
              ruleGain12Eur: fourni12GainEur, ruleGain14Eur: fourni14GainEur,
            });
            const { error: e3 } = await supabase.from("tournoi_raquettes").update({ gain_cents: Math.round(gainEur * 100), gain_frozen_at: new Date().toISOString() }).eq("id", r.id);
            if (e3) throw e3;
          }
          const { error: e4 } = await supabase.from("tournois").update({ locked: true, locked_at: new Date().toISOString() }).eq("tournoi", tournoiName);
          if (e4) throw e4;
          await load?.();
          showToast("✅ Tournoi verrouillé", "Gains figés et tournoi verrouillé.", "success");
          const { data: freshRow } = await supabase.from("tournois").select("*").eq("tournoi", tournoiName).maybeSingle();
          if (freshRow) setFresh(freshRow);
          window.dispatchEvent(new Event("tournois:updated"));
        } catch (e) { showToast("Erreur", e?.message || "Échec du verrouillage", "warning"); }
      }
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
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

            <NewClientInline onCreated={(id) => setPrefillClientId(id)} />

            <div>
              <div className="text-lg font-semibold mb-2">Ajouter une raquette</div>
              <TournoiRacketForm tournoiName={tournoiName} allowedCordeurs={cordeurs} prefillClientId={prefillClientId} />
            </div>

            <TournoiRacketsTable
              tournoiName={tournoiName}
              locked={!!fresh?.locked}
              onFinalize={finalizeTournament}
              onUnlock={unlockTournament}
              onOpenVentes={() => setShowVentesModal(true)}
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

      {/* Modale ventes par-dessus */}
      {showVentesModal && (
        <TournoiVentesModal
          tournoi={tournoi}
          onClose={() => setShowVentesModal(false)}
        />
      )}
    </>
  );
}