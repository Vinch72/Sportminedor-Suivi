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

/* ===== Dates helpers ===== */
function parseD(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + "T00:00:00");
  const d = new Date(v);
  return isNaN(+d) ? null : d;
}
function fmt(d) {
  return d ? d.toLocaleDateString("fr-FR") : "—";
}
function rangeLabel(row) {
  if (!row) return "—";
  // On privilégie start_date / end_date ; on tolère l’ancien champ "date"
  const start = parseD(row.start_date || row.date);
  const end = parseD(row.end_date || row.start_date || row.date);
  if (!start && !end) return "—";
  if (start && end && +start !== +end) return `Du ${fmt(start)} au ${fmt(end)}`;
  return `Le ${fmt(start || end)}`;
}

export default function TournoiDetailModal({ tournoi, onClose }) {
  if (!tournoi) return null;

  // `tournoi` peut être un objet {tournoi, start_date, ...} OU une string "nom"
  const initialName = typeof tournoi === "string" ? tournoi : tournoi?.tournoi;
  const [fresh, setFresh] = useState(typeof tournoi === "object" && tournoi ? tournoi : null);

  const tournoiName = fresh?.tournoi || initialName || "Tournoi";
  const [isFull, setIsFull] = useState(false);
  const [cordeurs, setCordeurs] = useState([]);
  const [prefillClientId, setPrefillClientId] = useState(null);
  const [showInfos, setShowInfos] = useState(true);

  // ✅ On récupère aussi rows + priceForRow + load du hook
  const { countsByStatut, rows: rackets, priceForRow, clubFlagsForRow, load } = useTournoiRackets(tournoiName);

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("info"); // success | info | warning

  function showToast(title, message = "", variant = "info") {
    setToastTitle(title);
    setToastMessage(message);
    setToastVariant(variant);
    setToastOpen(true);
  }

  // Confirm modal (remplace confirm())
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    title: "Confirmer",
    message: "",
    icon: "⚠️",
    confirmLabel: "Confirmer",
    cancelLabel: "Annuler",
    danger: false,
  });
  const [confirmAction, setConfirmAction] = useState(null);

  function askConfirm(config, action) {
    setConfirmConfig({
      title: config?.title ?? "Confirmer",
      message: config?.message ?? "",
      icon: config?.icon ?? "⚠️",
      confirmLabel: config?.confirmLabel ?? "Confirmer",
      cancelLabel: config?.cancelLabel ?? "Annuler",
      danger: !!config?.danger,
    });
    setConfirmAction(() => action);
    setConfirmOpen(true);
  }

  /* ===== Load (row + cordeurs) ===== */
  useEffect(() => {
    let mounted = true;

    async function loadTournament() {
      // si déjà objet complet passé en props, on peut néanmoins rafraîchir depuis la base
      const name = tournoiName;
      if (!name) return;
      const { data, error } = await supabase.from("tournois").select("*").eq("tournoi", name).maybeSingle();
      if (!mounted) return;
      if (!error && data) setFresh(data);
    }

    async function loadCordeurs() {
      const name = tournoiName;
      if (!name) return;
      const { data } = await supabase.from("tournoi_cordeurs").select("cordeur").eq("tournoi", name);
      if (!mounted) return;
      setCordeurs((data || []).map((d) => d.cordeur));
    }

    loadTournament();
    loadCordeurs();

    const onUpdated = () => {
      loadTournament();
      loadCordeurs();
    };
    window.addEventListener("tournois:updated", onUpdated);

    return () => {
      mounted = false;
      window.removeEventListener("tournois:updated", onUpdated);
    };
  }, [tournoiName]);

  /* ===== UI bits ===== */
  const Pill = ({ bg, value, label, emoji }) => (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-1 text-white"
      style={{ backgroundColor: bg }}
      title={label}
    >
      <span className="mr-1 align-middle relative top-[1px] text-[14px]" aria-hidden>
        {emoji}
      </span>
      <span className="font-extrabold">{value}</span>
      <span className="text-xs opacity-90">{label}</span>
    </div>
  );

  /* ===== Actions: verrouillage ===== */
  async function unlockTournament() {
    askConfirm(
      {
        title: "Déverrouiller ce tournoi ?",
        message: "Les gains figés restent enregistrés.",
        icon: "🔓",
        confirmLabel: "Déverrouiller",
        cancelLabel: "Annuler",
        danger: false,
      },
      async () => {
        try {
          const { error } = await supabase
            .from("tournois")
            .update({ locked: false, locked_at: null })
            .eq("tournoi", tournoiName);
          if (error) throw error;

          const { data: freshRow } = await supabase.from("tournois").select("*").eq("tournoi", tournoiName).maybeSingle();

          if (freshRow) setFresh(freshRow);
          window.dispatchEvent(new Event("tournois:updated"));
        } catch (e) {
          console.error(e);
          showToast("Erreur", e?.message || "Échec du déverrouillage", "warning");
        }
      }
    );
  }

  async function finalizeTournament() {
    askConfirm(
      {
        title: "Verrouiller le tournoi ?",
        message: "Figer tous les gains des raquettes cordées et verrouiller le tournoi ?",
        icon: "🔒",
        confirmLabel: "Verrouiller",
        cancelLabel: "Annuler",
        danger: true,
      },
      async () => {
        try {
          // 1) rows à figer (depuis le hook)
          const norm = (s) => (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
          const toFreeze = (rackets || []).filter(
            (r) => norm(r.statut_id) !== "A FAIRE" && r.gain_cents == null
          );

          // 2) gainMap depuis Données (cordages)
          const { data: cords, error: e2 } = await supabase.from("cordages").select("cordage, gain_cents");
          if (e2) throw e2;

          const gainMap = new Map(
            (cords || []).map((c) => [
              (c.cordage || "").toString().trim().toUpperCase(),
              Number.isInteger(c.gain_cents) ? c.gain_cents : 0,
            ])
          );
          
          const [{ data: f12 }, { data: f14 }] = await Promise.all([
            supabase.from("app_settings").select("*").eq("key", "fourni_gain_12_cents").maybeSingle(),
            supabase.from("app_settings").select("*").eq("key", "fourni_gain_14_cents").maybeSingle(),
          ]);

          const fourni12GainEur = ((f12?.value_cents ?? 1000) / 100);
          const fourni14GainEur = ((f14?.value_cents ?? 1166) / 100);

          // 3) figer
          for (const r of toFreeze) {
            const key = (r.cordage_id || "").toString().trim().toUpperCase();

            const tarif = priceForRow(r);
const flags = clubFlagsForRow(r);

const gainEur = computeGainCordeur({
  offert: !!r.offert,        // ✅ AJOUT
  fourni: !!r.fourni,
  tarifEur: tarif,

  bobineBase: flags.bobine_base,
  bobineSpecific: flags.bobine_specific,

  gainCentsSnapshot: null,
  gainFromCordageEur: (gainMap.get(key) ?? 0) / 100,

  ruleGain12Eur: fourni12GainEur,  // ✅ AJOUT (tu l'as déjà calculé)
  ruleGain14Eur: fourni14GainEur,  // ✅ AJOUT
});

            const cents = Math.round(gainEur * 100);

            const { error: e3 } = await supabase
              .from("tournoi_raquettes")
              .update({ gain_cents: cents, gain_frozen_at: new Date().toISOString() })
              .eq("id", r.id);
            if (e3) throw e3;
          }

          // 4) verrouiller le tournoi
          const { error: e4 } = await supabase
            .from("tournois")
            .update({ locked: true, locked_at: new Date().toISOString() })
            .eq("tournoi", tournoiName);
          if (e4) throw e4;

          // 5) refresh local + toast
          await load?.();
          showToast("✅ Tournoi verrouillé", "Gains figés et tournoi verrouillé.", "success");

          const { data: freshRow } = await supabase.from("tournois").select("*").eq("tournoi", tournoiName).maybeSingle();
          if (freshRow) setFresh(freshRow);

          window.dispatchEvent(new Event("tournois:updated"));
        } catch (e) {
          console.error(e);
          showToast("Erreur", e?.message || "Échec du verrouillage", "warning");
        }
      }
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <div
        className={`${
          isFull ? "absolute inset-0 h-full w-full max-w-none" : "absolute right-0 top-0 h-full w-full max-w-3xl"
        } bg-white shadow-xl p-4 overflow-y-auto transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header sticky */}
        <div className="sticky top-0 bg-white pb-2 z-10">
          <div className="flex items-start justify-between gap-3">
            {/* Gauche : titre + dates + cordeurs */}
            <div className="min-w-0">
              <div className="text-xl font-semibold flex items-center gap-2">
                <img src={logo} alt="" className="h-5 w-5 rounded-full select-none" />
                <span className="truncate">{tournoiName}</span>
              </div>
              <div className="text-sm text-gray-600">
                {rangeLabel(fresh)}
                {cordeurs.length ? ` • ${cordeurs.join(" • ")}` : " • —"}
              </div>
            </div>

            {/* Droite : action bar */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Toggle infos */}
              <button
                className="icon-btn"
                title={showInfos ? "Masquer les infos" : "Afficher les infos"}
                onClick={() => setShowInfos((s) => !s)}
                aria-label="Infos"
              >
                ℹ️
              </button>

              {/* Plein écran / réduire */}
              <button
                className="icon-btn"
                title={isFull ? "Réduire la fenêtre" : "Plein écran"}
                onClick={() => setIsFull((v) => !v)}
                aria-label={isFull ? "Réduire" : "Plein écran"}
              >
                <span aria-hidden>{isFull ? "🗗" : "🗖"}</span>
              </button>

              {/* Fermer */}
              <button className="icon-btn" title="Fermer" aria-label="Fermer" onClick={onClose}>
                ✖
              </button>
            </div>
          </div>
        </div>

        {/* Infos (collapsible) */}
        <div className="mt-3">
          <button className="text-[#E10600] underline" onClick={() => setShowInfos((s) => !s)}>
            {showInfos ? "Masquer les infos" : "Afficher les infos"}
          </button>
          {showInfos && <div className="mt-2 whitespace-pre-wrap border rounded-xl p-3">{fresh?.infos || "—"}</div>}
        </div>

        {/* Mini-form client */}
        <div className="mt-4">
          <NewClientInline onCreated={(id) => setPrefillClientId(id)} />
        </div>

        {/* Form raquette */}
        <div className="mt-4">
          <div className="text-lg font-semibold mb-2">Ajouter une raquette</div>
          <TournoiRacketForm tournoiName={tournoiName} allowedCordeurs={cordeurs} prefillClientId={prefillClientId} />
        </div>

        {/* Suivi */}
        <div className="mt-6">
          <TournoiRacketsTable
            tournoiName={tournoiName}
            locked={!!fresh?.locked}
            onFinalize={finalizeTournament}
            onUnlock={unlockTournament}
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
          onCancel={() => {
            setConfirmOpen(false);
            setConfirmAction(null);
          }}
          onConfirm={async () => {
            setConfirmOpen(false);
            const fn = confirmAction;
            setConfirmAction(null);
            await fn?.();
          }}
        />

        <Toast
          open={toastOpen}
          onClose={() => setToastOpen(false)}
          title={toastTitle}
          message={toastMessage}
          variant={toastVariant}
        />
      </div>
    </div>
  );
}