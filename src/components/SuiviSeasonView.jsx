// src/components/SuiviSeasonView.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { IconEdit, IconTrash } from "./ui/Icons";
import SuiviForm from "./SuiviForm";
import { SuiviFilters } from "../components/SuiviFilters";
import useIsSmall from "../hooks/useIsSmall"; // < 768px = mobile

// ===== Helpers =====
const FR_MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const pad2 = (n) => String(n).padStart(2, "0");
const seasonKeyFromDate = (d) => `${(d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1)}-${(d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1) + 1}`;
const monthKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const fmtDate = (v) => { try { const d = new Date(v); return isNaN(d) ? "—" : d.toLocaleDateString("fr-FR"); } catch { return "—"; } };
const euro = (n) => `${(Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const parseMoney = (v) => { if (v == null) return 0; const s = String(v).replace(/\s/g, ""); const m = s.match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(",", ".")) : 0; };
const parseDateLoose = (v) => {
  if (!v) return null;
  const d1 = new Date(v);
  if (!isNaN(d1)) return d1;
  let m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (m) { const [, Y, M, D, h, mi, s] = m.map(Number); return new Date(Y, M - 1, D, h, mi, s || 0); }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) { const [, Y, M, D] = m.map(Number); return new Date(Y, M - 1, D); }
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (m) { const [, D, M, Y] = m.map(Number); return new Date(Y, M - 1, D); }
  return null;
};
const U = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
const DEFAULT_GAIN_EUR = 6;

const canon = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const cordageKey = (s) => {
  const c = canon(s);
  if (c.includes("POSE")) return "POSE";
  const m = c.match(
    /(BG80POWER|BG80|BG65|BG66|EXBOLT63|EXBOLT65|EXBOLT68|NANOGY95|NANOGY98|NANOGY99|AEROBITE|SKYARC)/
  );
  return m ? m[1] : c;
};

// ⚠️ Pour POSE, on déduit 12/14 depuis r.tarif
function gainMagasinForRow(r, mapCordageGain) {
  const cord = canon(r.cordage_id);

  if (cord.includes("POSE")) {
    const t = Number(r.tarif) || parseMoney(r.tarif);
    if (Math.abs(t - 14) < 0.01) return 5.83;
    if (Math.abs(t - 12) < 0.01) return 5.00;
    return DEFAULT_GAIN_EUR;
  }

  return mapCordageGain.get(cordageKey(r.cordage_id)) ?? DEFAULT_GAIN_EUR;
}
const isMagasin = (v) => U(v) === "MAGASIN";

// --- Couleurs cordage -> teinte CSS (FR + variantes courantes) ---
const COLOR_MAP = {
  ROUGE: "#E10600",
  RED: "#E10600",
  ORANGE: "#F59E0B",
  JAUNE: "#EAB308",
  YELLOW: "#EAB308",
  VERT: "#22C55E",
  GREEN: "#22C55E",
  BLEU: "#3B82F6",
  BLUE: "#3B82F6",
  VIOLET: "#8B5CF6",
  MAUVE: "#8B5CF6",
  ROSE: "#EC4899",
  PINK: "#EC4899",
  NOIR: "#111827",
  BLACK: "#111827",
  GRIS: "#6B7280",
  GRAY: "#6B7280",
  BLANC: "#FFFFFF",
  WHITE: "#FFFFFF",
};

function isNoneColor(raw) {
  const up = U(raw || "");
  return !up || up === "NONE" || up === "AUCUNE" || up === "SANS" || up === "BLANC" || up === "WHITE";
}

function colorToCss(raw) {
  if (!raw) return null;
  const up = U(raw);
  const parts = up.split(/[\/,+]/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;

  const hexes = parts.map((p) => COLOR_MAP[p]).filter(Boolean);
  if (!hexes.length) return null;

  return hexes.length === 1 ? hexes[0] : `linear-gradient(90deg, ${hexes.join(",")})`;
}

// Pastille 8px : cercle (ou dégradé) avec léger bord pour garder du contraste
function Pastille({ value }) {
  if (isNoneColor(value)) return null;
  const css = colorToCss(value);
  const isGrad = typeof css === "string" && css.startsWith("linear-gradient");
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      aria-label={`Couleur: ${value}`}
      title={`Couleur: ${value}`}
      style={{
        width: 8,
        height: 8,
        marginRight: 4,
        background: isGrad ? css : (css || "transparent"),
        border: isGrad ? "1px solid #D1D5DB" : "1px solid rgba(0,0,0,0.12)",
      }}
    />
  );
}

// FK-safe mapping vers le libellé exact présent en base
function pickStatus(statuts, wanted) {
  const target = U(wanted);
  const hit = (statuts || []).find((s) => U(s.statut_id) === target);
  return hit ? hit.statut_id : wanted;
}
function hasStatus(statuts, wanted) {
  const target = U(wanted);
  return (statuts || []).some((s) => U(s.statut_id) === target);
}
function safePick(statuts, wanted, fallback) {
  const v = pickStatus(statuts, wanted);
  return hasStatus(statuts, v) ? v : pickStatus(statuts, fallback);
}
function clientLabel(row, mapClient) {
  const key = String(row.client_id ?? row.client ?? "");
  // utilise le snapshot si présent
  const snap = [row.client_prenom, row.client_nom].filter(Boolean).join(" ").trim();
  return snap || mapClient.get(key) || row.client_name || row.client || key || "—";
}

// flags → statut (priorités)
function decideStatut(statuts, { racket, bill, msg, ret }) {
  if (!racket) return pickStatus(statuts, "A FAIRE");                 // 1) raquette pas faite
  if (ret) return bill ? pickStatus(statuts, "RENDU")                 // 2) rendu prioritaire
                      : pickStatus(statuts, "A REGLER");
  if (msg)  return safePick(statuts, "MESSAGE ENVOYE", "A REGLER");   // 3) message envoyé avant "PAYE"
  if (bill) return pickStatus(statuts, "PAYE");                       // 4) payé
  return pickStatus(statuts, "A REGLER");                             // 5) sinon à régler
}

// ===== Component =====
export default function SuiviSeasonView() {
  const [rows, setRows] = useState([]);
  const [statuts, setStatuts] = useState([]);
  const [clients, setClients] = useState([]);
  const [cordages, setCordages] = useState([]);
  const [cordeurs, setCordeurs] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(false);
  const isSmall = useIsSmall(); // true en mobile

  const remunMagasinSet = useMemo(() => {
  const set = new Set();
  (cordeurs || []).forEach((c) => {
    if (c?.remun_magasin) set.add(U(c.cordeur));
  });
  return set;
}, [cordeurs]);

  const mapCordageGain = useMemo(() => {
  const m = new Map();
  (cordages || []).forEach((c) => {
    const key = cordageKey(c.cordage);
    const eur = c.gain_cents != null ? Number(c.gain_cents) / 100 : null;
    if (key && eur != null) m.set(key, eur);
  });
  return m;
}, [cordages]);

  const [filters, setFilters] = useState({
  clientQuery: "",
  phoneQuery: "",
  clubQuery: "",
  statutId: "",
  dateExact: "",
  cordeurId: "",
});
  const [openSeasons, setOpenSeasons] = useState({});
  const [openMonths, setOpenMonths] = useState({});
  const [editingRow, setEditingRow] = useState(null);

  // Modales locales
  const [payDialog, setPayDialog] = useState(null); // { row }
  const [msgDialog, setMsgDialog] = useState(null); // { row, phone }
  const [deleteDialog, setDeleteDialog] = useState(null); // { id, title }
  const [noteDialog, setNoteDialog] = useState(null); // { title, note } | null
  const [phoneDialog, setPhoneDialog] = useState(null); // { name, phone }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1) on tente avec created_at
      let sSuivi = await supabase
        .from("suivi")
        .select("*")
        .order("created_at", { ascending: false }) // 1) insertion la + récente
        .order("id", { ascending: false })         // 2) sinon id le + grand
        .order("date", { ascending: false });      // 3) la date vient après
  
      // 2) fallback si la colonne n'existe pas
      if (sSuivi.error) {
        sSuivi = await supabase
          .from("suivi")
          .select("*")  
          .order("id", { ascending: false })
          .order("date", { ascending: false });
        if (sSuivi.error) throw sSuivi.error;
      }
  
      const [sStatuts, sClients, sCordages, sCordeurs, sClubs, sPay] = await Promise.all([      
        supabase.from("statuts").select("statut_id"),
        supabase.from("clients").select("id, nom, prenom"),
        supabase.from("cordages").select("cordage, gain_cents, gain_magasin_cents"),
        supabase.from("cordeur").select("cordeur, remun_magasin").order("cordeur"),
        supabase.from("clubs").select("clubs"),
        supabase.from("payment_modes").select("*").order("sort_order").order("label"),
        supabase.from("express")
      ]);
  
      setRows(sSuivi.data || []);
      if (!sStatuts.error) setStatuts(sStatuts.data || []);
      if (!sClients.error) setClients(sClients.data || []);
      if (!sCordages.error) setCordages(sCordages.data || []);
      if (!sCordeurs.error) setCordeurs(sCordeurs.data || []);
      if (!sClubs.error) setClubs(sClubs.data || []);
  
      const now = new Date();
      const curKey = seasonKeyFromDate(now);
      const mk = monthKey(now);
      setOpenSeasons((p) => ({ ...p, [curKey]: true }));
      setOpenMonths((p) => ({ ...p, [`${curKey}|${mk}`]: true }));

      const { data: pay, error: payErr } = await supabase
      .from("payment_modes")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (!payErr) {
      // on garde ceux activés (enabled true ou null) + mapping propre
      const list = (pay || [])
        .filter(m => m.enabled !== false)
        .map(m => ({
          code: m.code || (m.label ?? "").trim(),
          label: m.label || m.code || "—",
          emoji: m.emoji || "💶",
        }));
      setPaymentModes(list);
    }      
    } finally {
      setLoading(false);
    }
  }, []);  

  useEffect(() => { load(); }, [load]);

  // Si des client_id visibles ne sont pas encore dans la map, on les récupère par leur ID
useEffect(() => {
  const have = new Set((clients || []).map(c => String(c.id ?? "")));
  const need = Array.from(
    new Set(
      (rows || [])
        .map(r => String(r.client_id ?? ""))
        .filter(id => id && !have.has(id))
    )
  );
  if (need.length === 0) return;

  (async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, nom, prenom")
      .in("id", need);

    if (!error && Array.isArray(data) && data.length) {
      setClients(prev => {
        const seen = new Set(prev.map(c => String(c.id ?? "")));
        const add = data.filter(c => !seen.has(String(c.id ?? "")));
        return add.length ? prev.concat(add) : prev;
      });
    }
  })();
}, [rows, clients]);

  // live refresh
  useEffect(() => {
    const ch = supabase.channel("suivi:seasoned").on("postgres_changes", { event: "*", schema: "public", table: "suivi" }, () => load()).subscribe();
    const bump = () => load();
    window.addEventListener("suivi:created", bump);
    window.addEventListener("suivi:updated", bump);
    window.addEventListener("suivi:deleted", bump);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("suivi:created", bump);
      window.removeEventListener("suivi:updated", bump);
      window.removeEventListener("suivi:deleted", bump);
    };
  }, [load]);

  // lookups
const mapCordageGainMagasin = useMemo(() => {
  const m = new Map();
  (cordages || []).forEach((c) => {
    const key = cordageKey(c.cordage);
    const eur = c.gain_magasin_cents != null ? Number(c.gain_magasin_cents) / 100 : null;
    if (key && eur != null) m.set(key, eur);
  });
  return m;
}, [cordages]);

  const mapClient = useMemo(() => {
    const m = new Map();
    clients.forEach(c => {
      const key = String(c.id ?? "");
      const label = `${c.nom || ""} ${c.prenom || ""}`.trim() || key;
      if (key) m.set(key, label);
    });
    return m;
  }, [clients]);
  const mapCordage = useMemo(() => { const m = new Map(); cordages.forEach(c => m.set(c.cordage, c.cordage)); return m; }, [cordages]);
  const mapCordeur = useMemo(() => { const m = new Map(); cordeurs.forEach(c => m.set(c.cordeur, c.cordeur)); return m; }, [cordeurs]);

  const statusOptions = useMemo(() => statuts.map(s => s.statut_id), [statuts]);
  const statutsOptions = useMemo(() => (statusOptions ?? []).map((s) => ({ id: String(s), name: String(s) })), [statusOptions]);
  const clientsOptions = useMemo(() => (clients ?? []).map((c) => ({ id: String(c.id ?? ""), name: String(`${c.nom || ""} ${c.prenom || ""}`.trim() || c.id) })).filter(o => o.id && o.name), [clients]);
  const clubsOptions = useMemo(
    () => (clubs ?? [])
      .map((c) => ({ id: String(c.clubs ?? ""), name: String(c.clubs ?? "") }))
      .filter(o => o.id && o.name),
    [clubs]
  );
  const cordeursOptions = useMemo(() => (cordeurs ?? []).map((c) => ({ id: String(c.cordeur ?? c.id ?? ""), name: String(c.cordeur ?? c.id ?? "") })).filter(o => o.id && o.name), [cordeurs]);

  const clientById = useMemo(() => Object.fromEntries(clientsOptions.map(c => [c.id, c.name])), [clientsOptions]);
  const clubById = useMemo(() => Object.fromEntries((clubsOptions ?? []).map((c) => [c.id, c.name])), [clubsOptions]);

  // filtresconst phone = normalize(r.client_phone || "");
  const normalize = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const strip = (s) => normalize(s).replace(/\s+/g, "");
  const filteredRows = useMemo(() => {
    const qClient = normalize(filters.clientQuery);
    const qClub = normalize(filters.clubQuery);
    const qPhone = strip(filters.phoneQuery);
    const exact = (filters.dateExact || "").trim(); // "YYYY-MM-DD"
    return (rows ?? []).filter((r) => {
      const clientName = normalize(clientLabel(r, mapClient));
      const phone = strip(r.client_phone || "");
      const clubName = normalize(
        (r.club_id && String(r.club_id)) ||
        (r.club && String(r.club)) ||
        ""
      );
      const statutId = String(r.statut_id ?? "");
      const cordeurId = String(r.cordeur_id ?? r.cordeur ?? "");

      if (qClient && !(clientName.includes(qClient) || phone.includes(qClient))) return false;
      if (qClub && !clubName.includes(qClub)) return false;
      if (qPhone && !phone.includes(qPhone)) return false;
      if (filters.statutId && statutId !== filters.statutId) return false;
      if (filters.cordeurId && cordeurId !== filters.cordeurId) return false;

      if (exact) {
        const d = new Date(r.date);
        if (isNaN(+d)) return false;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const iso = `${y}-${m}-${day}`;
        if (iso !== exact) return false;
      }
      return true;
    });
  }, [rows, filters, mapClient, clubById]);

// index (ordre d'arrivée) pour garder l'ordre Supabase comme dernier tiebreaker
const indexById = useMemo(() => {
  const m = new Map();
  (rows || []).forEach((r, i) => m.set(r.id, i));
  return m;
}, [rows]);

  // groupement par saison/mois
  const grouped = useMemo(() => {
    const g = {};
    const sansDate = [];
    for (const r of filteredRows) {
      const d = parseDateLoose(r.date);
      if (!d) { sansDate.push(r); continue; }
      const sKey = seasonKeyFromDate(d), mKey = monthKey(d), label = `${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!g[sKey]) g[sKey] = { months: {} };
      if (!g[sKey].months[mKey]) g[sKey].months[mKey] = { label, items: [] };
      g[sKey].months[mKey].items.push(r);
    }
    const seasons = Object.keys(g).sort((a, b) => b.localeCompare(a));
    return {
      seasons: seasons.map(sk => ({
        season: sk,
        months: Object.entries(g[sk].months)
        .sort(([a], [b]) => {
          const [ya, ma] = a.split("-").map(Number);
          const [yb, mb] = b.split("-").map(Number);
          if (ya !== yb) return yb - ya;   // année récente d'abord
          return mb - ma;                  // mois récent d'abord
        })
          .map(([k, v]) => {
            // tri mois: 1) date desc 2) id desc
            const items = v.items.slice().sort((a, b) => {
              // 1) created_at desc (moment d'insertion)
              const ac = a.created_at ? +new Date(a.created_at) : 0;
              const bc = b.created_at ? +new Date(b.created_at) : 0;
              if (ac !== bc) return bc - ac;
            
              // 2) id desc (si pas de created_at fiable)
              const ai = Number.isFinite(Number(a.id)) ? Number(a.id) : 0;
              const bi = Number.isFinite(Number(b.id)) ? Number(b.id) : 0;
              if (ai !== bi) return bi - ai;
            
              // 3) date desc (affichage logique par jour)
              const ad = +new Date(a.date) || 0;
              const bd = +new Date(b.date) || 0;
              if (ad !== bd) return bd - ad;
            
              // 4) filet de sécurité : garder l'ordre serveur (desc)
              const ia = indexById.get(a.id) ?? 0;
              const ib = indexById.get(b.id) ?? 0;
              return ib - ia;
            });            
            return { key: k, label: v.label, items };
          })
      })),
      sansDate
    };
  }, [filteredRows]);

  // ===== Actions =====
  async function updateRowStatut(id, newStatut) {
    const { error } = await supabase.from("suivi").update({ statut_id: newStatut }).eq("id", id);
    if (error) { console.error(error); alert("Mise à jour du statut refusée."); return; }
    setRows(prev => prev.map(r => r.id === id ? { ...r, statut_id: newStatut } : r));
  }

  function canonMode(m) {
    if (!m) return null;
    const s = String(m).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    if (s.includes("cb") || s.includes("carte")) return "CB";
    if (s.startsWith("esp")) return "Especes";
    if (s.startsWith("cheq")) return "Cheque";
    if (s.startsWith("vir")) return "Virement";
    if (s.includes("offert") || s.includes("gratuit")) return "Offert";
    return m;
  }

  async function updateRowPayment(row, mode) {
    const modeCanon = canonMode(mode);
    const patch = {
      reglement_mode: modeCanon || null,
      reglement_date: modeCanon ? new Date().toISOString() : null,
    };
    if (modeCanon === "Offert") patch.tarif = "0";
    const { error } = await supabase.from("suivi").update(patch).eq("id", row.id);
    if (error) { console.error(error); alert("Mise à jour du règlement refusée : " + (error.message || "")); return; }
    const updated = { ...row, ...patch };
    setRows(prev => prev.map(r => r.id === row.id ? updated : r));
    return updated; // <-- on renvoie la ligne à jour
  }

  async function updateRowCordeur(row, cordeurId) {
    const patch = { cordeur_id: cordeurId || null };
    const { error } = await supabase.from("suivi").update(patch).eq("id", row.id);
    if (error) { console.error(error); alert("Mise à jour cordeur refusée."); return; }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...patch } : r));
  }

  function askDelete(row) {
    const title =
      `${fmtDate(row.date)} • ${clientLabel(row, mapClient)} • ` +
      `${row.raquette || (mapCordage.get(row.cordage_id) || "—")}`;
    setDeleteDialog({ id: row.id, title });
  }

  async function confirmDelete() {
    if (!deleteDialog?.id) return setDeleteDialog(null);
    const id = deleteDialog.id;
    const { error } = await supabase.from("suivi").delete().eq("id", id);
    if (error) { console.error(error); alert("Suppression refusée."); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    window.dispatchEvent(new CustomEvent("suivi:deleted", { detail: { id } }));
    setDeleteDialog(null);
  }

  // Flags (verts/gris) dérivés d'une ligne
  function deriveFlags(row) {
    const racket = U(row.statut_id) !== "A FAIRE";                                    // 🎾
    const bill   = !!(row.reglement_mode && String(row.reglement_mode).trim());       // 💶
    const msg    = !!row.contacted_at || U(row.statut_id) === "MESSAGE ENVOYE";       // 💬
    const ret    = U(row.statut_id) === "RENDU";                                      // ↩️
    return { racket, bill, msg, ret };
  }

  async function applyStatut(row, flags) {
    const statut = decideStatut(statuts, flags);
    const { error } = await supabase.from("suivi").update({ statut_id: statut }).eq("id", row.id);
    if (error) { alert("Maj statut refusée: " + (error.message || "")); return false; }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, statut_id: statut } : r));
    return true;
  }

  // 🎾 toggle fait/pas fait
  async function toggleRacket(row) {
    const f = deriveFlags(row);
    const next = { ...f, racket: !f.racket };
    await applyStatut(row, next);
  }

 // 💶 toggle payé/non payé (utilise une modale propre pour choisir le mode)
async function toggleBill(row) {
  const f = deriveFlags(row);
  if (f.bill) {
    // désactiver le paiement
    const patch = { reglement_mode: null, reglement_date: null };
    const { error } = await supabase.from("suivi").update(patch).eq("id", row.id);
    if (error) { alert("Maj règlement refusée: " + (error.message || "")); return; }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...patch } : r));
    await applyStatut(row, { ...f, bill: false });
  } else {
    // ouvrir la modale de choix du mode de paiement
    setPayDialog({ row });
  }
}

async function handlePickPayment(row, modeCanon) {
  try {
    await updateRowPayment(row, modeCanon);
    const updated = { ...row, reglement_mode: modeCanon, reglement_date: new Date().toISOString() };
    await applyStatut(updated, { ...deriveFlags(updated), bill: true });
  } finally {
    setPayDialog(null);
  }
}

 // 💬 toggle message envoyé / non envoyé (modale propre + SMS)
async function toggleMessage(row) {
  const f = deriveFlags(row);
  if (f.msg) {
    const { error } = await supabase.from("suivi").update({ contacted_at: null }).eq("id", row.id);
    if (error) { console.warn(error); }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, contacted_at: null } : r));
    await applyStatut(row, { ...f, msg: false });
  } else {
    try {
      const { data: c } = await supabase.from("clients").select("*").eq("id", row.client_id).maybeSingle();
      const phone = c?.tel || c?.phone || c?.telephone || c?.mobile || "";
      setMsgDialog({ row, phone });
    } catch {
      setMsgDialog({ row, phone: "" });
    }
  }
}

async function markMessageSent(row) {
  const when = new Date().toISOString();
  await supabase.from("suivi").update({ contacted_at: when }).eq("id", row.id);
  setRows(prev => prev.map(r => r.id === row.id ? { ...r, contacted_at: when } : r));
  await applyStatut({ ...row, contacted_at: when }, { ...deriveFlags({ ...row, contacted_at: when }), msg: true });
}

  // ↩️ toggle rendu / non rendu
  async function toggleReturn(row) {
    const f = deriveFlags(row);
    const next = { ...f, ret: !f.ret };
    await applyStatut(row, next);
  }

  function RowMobile({ r }) {
    const flags = deriveFlags(r);
    const dateFR = fmtDate(r.date);
    const tarifLabel = (() => {
      const n = parseMoney(r.tarif);
      return n ? euro(n) : "—";
    })();
    const client = clientLabel(r, mapClient);
    const cordeurName = mapCordeur.get(r.cordeur_id) || r.cordeur_id || "—";
    const cordage = mapCordage.get(r.cordage_id) || r.cordage_id || "—";
  
    const pill = (active) =>
      `inline-flex h-8 w-8 items-center justify-center rounded-full border transition
       ${active ? "bg-green-500 text-white border-green-600" : "bg-gray-100 text-gray-500 border-gray-200"}`;
  
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-3 space-y-2 overflow-hidden">
        {/* entête: date + client + statut */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">{dateFR}</div>
            <div className="font-semibold truncate">{client}</div>
           <div className="flex items-center min-w-0">
  {/* Texte raquette (prend la place) */}
  <div className="text-sm text-gray-700 truncate flex-1 min-w-0">
    {r.raquette || "—"}
  </div>

  {/* Colonne icônes (largeur fixe = alignement parfait) */}
  <div className="flex items-center gap-2 w-[72px] justify-end shrink-0">
    {r.client_phone && (
      <button
        type="button"
        className="text-xs px-2 py-1 rounded-full border bg-white hover:bg-gray-50"
        title={`Téléphone: ${r.client_phone}`}
        onClick={() =>
          setPhoneDialog({
            name: clientLabel(r, mapClient),
            phone: r.client_phone,
          })
        }
      >
        📞
      </button>
    )}

    {r.note ? (
      <button
        type="button"
        className="shrink-0 w-7 h-7 rounded-full border bg-white hover:bg-gray-50"
        title="Voir la note"
        onClick={(e) => {
          e.stopPropagation();
          setNoteDialog({
            title: `${client} • ${r.raquette || "—"}`,
            note: r.note,
          });
        }}
      >
        📝
      </button>
    ) : null}
  </div>
</div>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">
            {r.statut_id || "—"}
          </span>
        </div>
  
        {/* infos techniques */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="truncate">
            <span className="text-gray-500">Cordage :</span> <b>{cordage}</b>
          </div>
          <div className="truncate">
            <span className="text-gray-500">Tension :</span> <b>{r.tension || "—"}</b>
          </div>
          <div className="truncate">
            <span className="text-gray-500">Lieu :</span>{" "}
            <b>{r.club_id || r.club || r.lieu_id || "—"}</b>
          </div>
          <div className="truncate text-right">
            <b>{tarifLabel}</b>
          </div>
        </div>
  
        {/* rangée: pictos + cordeur (sur la même ligne) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button type="button" className={pill(flags.racket)} title="Fait / Pas fait" onClick={() => toggleRacket(r)}>🎾</button>
            <button type="button" className={pill(flags.bill)}   title="Payé / Non payé" onClick={() => toggleBill(r)}>💶</button>
            <button type="button" className={pill(flags.msg)}    title="Message envoyé / Non envoyé" onClick={() => toggleMessage(r)}>💬</button>
            <button type="button" className={pill(flags.ret)}    title="Rendu / Non rendu" onClick={() => toggleReturn(r)}>↩️</button>
          </div>
  
          <select
            className="h-8 px-2 rounded-md border text-xs"
            value={String(r.cordeur_id ?? "")}
            onChange={(e) => updateRowCordeur(r, e.target.value || null)}
            title="Cordeur"
          >
            <option value="">— Cordeur —</option>
            {cordeursOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
  
        {/* rangée: paiement + tarif (séparée, donc plus de “CB/Offert” qui traîne) */}
        <div className="flex items-center gap-2">
          <select
            className="h-9 px-2 rounded-lg border text-sm bg-white appearance-none"
            value={String(r.reglement_mode ?? "")}
            title={r.reglement_mode ? `Règlement: ${r.reglement_mode}` : "À régler"}
            onChange={async (e) => {
              const next = e.target.value || null;
              const updated = await updateRowPayment(r, next);
              if (updated) await applyStatut(updated, deriveFlags(updated));
            }}
          >
            <option value="">À régler</option>
            {paymentModes.map(pm => (
              <option key={pm.code} value={pm.code}>{pm.label}</option>
            ))}
          </select>
        </div>
  
        {/* actions */}
        <div className="flex items-center justify-end gap-2">
          <button className="icon-btn" title="Éditer" onClick={() => setEditingRow(r)}><IconEdit /></button>
          <button className="icon-btn-red" title="Supprimer" onClick={() => askDelete(r)}><IconTrash /></button>
        </div>
      </div>
    );
  }  
  function RowDesktop({ r }) {
    const flags = deriveFlags(r);
    const pill = (active) =>
      `inline-flex h-8 w-8 items-center justify-center rounded-full border transition
       ${active ? "bg-green-500 text-white border-green-600" : "bg-gray-100 text-gray-500 border-gray-200"}`;
    const tarifLabel = (() => { const n = parseMoney(r.tarif); return n ? euro(n) : "—"; })();
  
    return (
      <div
        className="grid items-center gap-3 bg-gray-100 rounded-lg shadow-sm border border-transparent hover:bg-white hover:border-[#E10600] hover:shadow transition-colors duration-150 px-3 py-2"
        style={{
          gridTemplateColumns:
            "minmax(260px,1.8fr) minmax(120px,1fr) minmax(200px,1.2fr) minmax(120px,0.9fr) 120px 64px 160px 130px 72px",
        }}
      >
        <div className="min-w-0 flex items-center">
  <span className="text-gray-500 shrink-0 mr-2">{fmtDate(r.date)}</span>

  {/* nom client */}
  <span className="truncate flex-1 min-w-0">
    {clientLabel(r, mapClient)}
  </span>

  {/* colonne icône téléphone */}
  <div className="w-[40px] shrink-0 flex justify-end">
    {r.client_phone && (
      <button
        type="button"
        className="text-xs px-2 py-1 rounded-full border bg-white hover:bg-gray-50"
        title={`Téléphone: ${r.client_phone}`}
        onClick={() =>
          setPhoneDialog({
            name: clientLabel(r, mapClient),
            phone: r.client_phone,
          })
        }
      >
        📞
      </button>
    )}
  </div>
        </div>
       <div className="min-w-0 flex items-center">
  {/* modèle raquette */}
  <span className="truncate flex-1 min-w-0">
    {r.raquette || "—"}
  </span>

  {/* colonne icône note */}
  <div className="w-[40px] shrink-0 flex justify-end">
    {r.note ? (
      <button
        type="button"
        className="w-7 h-7 rounded-full border bg-white hover:bg-gray-50"
        title="Voir la note"
        onClick={(e) => {
          e.stopPropagation();
          setNoteDialog({
            title: `${clientLabel(r, mapClient)} • ${r.raquette || "—"}`,
            note: r.note,
          });
        }}
      >
        📝
      </button>
    ) : null}
  </div>
</div>
        <div className="min-w-0 flex items-center gap-1 font-semibold text-sm md:text-base truncate">
          <Pastille value={r.couleur} />
          <span className="truncate">{mapCordage.get(r.cordage_id) || r.cordage_id || "—"}</span>
          {r.tension && <span className="mx-1 font-normal text-gray-700">•</span>}
          <span className="truncate">{r.tension || "—"}</span>
        </div>
        <div className="min-w-0 truncate text-sm text-gray-700">
          {(r.club && String(r.club)) || (r.club_id && String(r.club_id)) || "—"}
        </div>
        <div className="min-w-0">
          <select
            className={`w-full h-8 px-2 py-0.5 rounded-md border border-gray-300 text-xs bg-white ${!r.reglement_mode ? "text-gray-500 italic" : ""}`}
            value={String(r.reglement_mode ?? "")}
            title={r.reglement_mode ? `Règlement: ${r.reglement_mode}` : "À régler"}
            onChange={async (e) => {
              const next = e.target.value || null;
              const updated = await updateRowPayment(r, next);
              if (updated) await applyStatut(updated, deriveFlags(updated));
            }}
          >
            <option value="">A régler</option>
            {paymentModes.map(pm => <option key={pm.code} value={pm.code}>{pm.label}</option>)}
          </select>
        </div>
        <div className="text-right text-sm">{tarifLabel}</div>
        <div className="flex items-center justify-center gap-2">
          <button type="button" className={pill(flags.racket)} title="Fait / Pas fait" onClick={() => toggleRacket(r)}>🎾</button>
          <button type="button" className={pill(flags.bill)}   title="Payé / Non payé" onClick={() => toggleBill(r)}>💶</button>
          <button type="button" className={pill(flags.msg)}    title="Message envoyé / Non envoyé" onClick={() => toggleMessage(r)}>💬</button>
          <button type="button" className={pill(flags.ret)}    title="Rendu / Non rendu" onClick={() => toggleReturn(r)}>↩️</button>
        </div>
        <div className="min-w-0">
          <select
            className="w-full h-8 px-2 py-0.5 rounded-md border border-gray-300 text-xs"
            value={String(r.cordeur_id ?? "")}
            onChange={(e) => updateRowCordeur(r, e.target.value || null)}
          >
            <option value="">— Cordeur —</option>
            {cordeursOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button className="icon-btn" title="Éditer" onClick={() => setEditingRow(r)}><IconEdit /></button>
          <button className="icon-btn-red" title="Supprimer" onClick={() => askDelete(r)}><IconTrash /></button>
        </div>
      </div>
    );
  }

  // ===== Render =====  
  return (
    <div className="space-y-3">
      <SuiviFilters
        filters={filters}
        onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
        clients={clientsOptions}
        clubs={clubsOptions}
        statuts={statutsOptions}
        cordeurs={(cordeurs ?? []).map(c => ({ id: String(c.cordeur ?? c.id ?? ""), name: String(c.cordeur ?? c.id ?? "") }))}
      />

      {loading && <div className="text-sm text-gray-600">Chargement…</div>}

      {!loading && grouped.seasons.map(({ season, months }) => {
        const openS = !!openSeasons[season];
        return (
          <div key={season} className="card">
            <div className="flex items-center justify-between">
              <div className="section-bar">{`Saison ${season}`}</div>
              <button className="icon-btn" onClick={() => setOpenSeasons(p => ({ ...p, [season]: !openS }))}>{openS ? "▾" : "▸"}</button>
            </div>

            {openS && (
              <div className="mt-3 grid grid-cols-1 gap-2">{/* pleine largeur par mois */}
                {months.map(({ key: mk, label, items }) => {
                  const mkKey = `${season}|${mk}`, openM = !!openMonths[mkKey];
                  return (
                    <div key={mk} className="rounded-2xl border p-3 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{label}</div>
                        <button className="icon-btn" onClick={() => setOpenMonths(p => ({ ...p, [mkKey]: !openM }))}>{openM ? "▾" : "▸"}</button>
                      </div>

                      {openM && (
                        <>
                          {/* Récap mensuel simple */}
                          {(() => {
const done = Array.from(
  new Map(
    items
      .filter(r => U(r.statut_id) !== "A FAIRE")
      .map(r => [r.id, r]) // clé = id
  ).values()
);

  const totalRevenue = done.reduce((a, r) => a + parseMoney(r.tarif), 0);

  const countByCordeur = {};
  for (const r of done) {
    const name = (mapCordeur.get(r.cordeur_id) || r.cordeur_id || "—");
    countByCordeur[name] = (countByCordeur[name] || 0) + 1;
  }

// Gains détaillés par cordeur (cordée + lieu magasin + cordeur éligible)
const gainsByCordeur = {};

for (const r of done) {
  const lieu = r.lieu_id || r.club_id || r.club;
  const estMagasin = isMagasin(lieu);

  const nom = (mapCordeur.get(r.cordeur_id) || r.cordeur_id || "").trim();
  const eligible = nom && remunMagasinSet.has(U(nom));

  if (!estMagasin || !eligible) continue;

  const gain = gainMagasinForRow(r, mapCordageGainMagasin);
  gainsByCordeur[nom] = (gainsByCordeur[nom] || 0) + gain;
}

  return (
    <div className="mt-2 grid md:grid-cols-4 gap-2">{/* ← 3 -> 4 colonnes */}
      <div className="rounded-xl border p-3">
        <div className="text-sm text-gray-600">Argent total généré</div>
        <div className="text-xl font-bold">{euro(totalRevenue)}</div>
      </div>

      <div className="rounded-xl border p-3">
        <div className="text-sm text-gray-600">Raquettes par cordeur</div>
        <ul className="text-sm mt-1 space-y-0.5">
          {Object.keys(countByCordeur).length === 0 && <li>—</li>}
          {Object.entries(countByCordeur).map(([k, v]) => (
            <li key={k}>{k}: <b>{v}</b></li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border p-3">
  <div className="text-sm text-gray-600">Gain cordeur (magasin)</div>
  {Object.keys(gainsByCordeur).length === 0 ? (
    <div className="text-xl font-bold">—</div>
  ) : (
    <ul className="text-sm mt-1 space-y-0.5">
      {Object.entries(gainsByCordeur)
        .sort(([a], [b]) => a.localeCompare(b, "fr"))
        .map(([k, v]) => (
          <li key={k} className="flex justify-between">
            <span>{k}</span>
            <b>{euro(v)}</b>
          </li>
        ))}
    </ul>
  )}
</div>

      <div className="rounded-xl border p-3">
        <div className="text-sm text-gray-600">Entrées (mois)</div>
        <div className="text-xl font-bold">{items.length}</div>
      </div>
    </div>  
  );
})()}

                          {/* --- Liste des lignes du mois --- */}
                    <div className={isSmall ? "mt-2 space-y-3" : "mt-2 space-y-2"}>
                      {items.map((r) =>
                        isSmall ? <RowMobile key={r.id} r={r} /> : <RowDesktop key={r.id} r={r} />
                      )}
                    </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Bloc "Sans date" si besoin */}
      {!loading && grouped.sansDate.length > 0 && (
        <div className="card">
          <div className="section-bar">Sans date</div>
          <div className="mt-2 space-y-2">
            {grouped.sansDate.map((r) => (
              <div
                key={r.id}
                className="px-3 py-2 flex items-center gap-6 bg-gray-100 rounded-lg shadow-sm border border-transparent hover:bg-white hover:border-[#E10600] hover:shadow transition-colors duration-150"
              >
                <div className="w-72 truncate">
                  <span className="text-gray-500 mr-2">{fmtDate(r.date)}</span>
                  <span>{(r.raquette || "—")}</span>
                </div>
                <div className="w-60 truncate">{clientLabel(r, mapClient)}</div>
                <div className="w-56 font-semibold truncate">
                  {(mapCordage.get(r.cordage_id) || r.cordage_id || "—")}{r.tension ? ` • ${r.tension}` : ""}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button className="icon-btn" title="Éditer" onClick={() => setEditingRow(r)}><IconEdit /></button>
                  <button className="icon-btn-red" title="Supprimer" onClick={() => askDelete(r)}><IconTrash /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modale édition */}
      {editingRow && (
        <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={() => setEditingRow(null)}>
<div
  className="w-full max-w-xl bg-white max-h-[90vh] p-4 overflow-y-auto rounded-l-2xl"
  onClick={(e) => e.stopPropagation()}
>
            <SuiviForm
              editingId={editingRow.id}
              initialData={editingRow}
              onDone={() => {
                setEditingRow(null);
                window.dispatchEvent(new CustomEvent("suivi:updated", { detail: { id: editingRow.id } }));
              }}
            />
          </div>
        </div>
      )}

{/* Modale note */}
{noteDialog && (
  <div
    className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/40"
    onClick={() => setNoteDialog(null)}
  >
    <div
      className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none">📝</div>
        <div className="flex-1">
          <div className="text-lg font-semibold">Note</div>
          <div className="text-sm text-gray-600">{noteDialog.title}</div>
        </div>
        <button
          aria-label="Fermer"
          className="text-gray-500 hover:text-black"
          onClick={() => setNoteDialog(null)}
        >
          ✕
        </button>
      </div>

      <div className="mt-4 p-3 rounded-xl border bg-gray-50 text-sm whitespace-pre-wrap">
        {noteDialog.note}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={() => setNoteDialog(null)}
          className="px-4 h-10 rounded-xl border text-gray-700 hover:bg-gray-50"
        >
          Fermer
        </button>
      </div>
    </div>
  </div>
)}
{deleteDialog && (
  <div
    className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40"
    onClick={() => setDeleteDialog(null)}
  >
    <div
      className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none">🗑️</div>
        <div className="flex-1">
          <div className="text-lg font-semibold">Supprimer cette raquette ?</div>
          <div className="text-sm text-gray-600">
            {deleteDialog.title}
          </div>
        </div>
        <button
          aria-label="Fermer"
          className="text-gray-500 hover:text-black"
          onClick={() => setDeleteDialog(null)}
        >
          ✕
        </button>
      </div>

      <div className="mt-4 p-3 rounded-xl border bg-gray-50 text-sm">
        Cette action est <b>définitive</b>. Tu pourras toujours la ressaisir manuellement.
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          className="px-4 h-10 rounded-xl border text-gray-700 hover:bg-gray-50"
          onClick={() => setDeleteDialog(null)}
        >
          Annuler
        </button>
        <button
          className="px-4 h-10 rounded-xl bg-red-600 text-white hover:bg-red-700"
          onClick={confirmDelete}
        >
          Supprimer
        </button>
      </div>
    </div>
  </div>
)}

      {/* Modale choix du mode de règlement */}
{payDialog && (
  <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40" onClick={() => setPayDialog(null)}>
    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none">💶</div>
        <div className="flex-1">
          <div className="text-lg font-semibold">Mode de règlement</div>
          <div className="text-sm text-gray-600">Choisis le mode utilisé pour cette raquette.</div>
        </div>
        <button aria-label="Fermer" className="text-gray-500 hover:text-black" onClick={() => setPayDialog(null)}>✕</button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
  {paymentModes.map((pm) => (
    <button
      key={pm.code}
      type="button"
      onClick={() => handlePickPayment(payDialog.row, pm.code)}
      className="flex items-center justify-center gap-2 h-11 rounded-xl border bg-white hover:bg-gray-50 hover:shadow transition"
    >
      <span className="text-lg">{pm.emoji || "💶"}</span>
      <span className="font-medium">{pm.label}</span>
    </button>
  ))}
</div>
      <div className="mt-5 flex justify-end">
        <button onClick={() => setPayDialog(null)} className="px-4 h-10 rounded-xl border text-gray-700 hover:bg-gray-50">
          Annuler
        </button>
      </div>
    </div>
  </div>
)}

{/* Modale envoi message */}
{msgDialog && (
  <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40" onClick={() => setMsgDialog(null)}>
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none">📩</div>
        <div className="flex-1">
          <div className="text-lg font-semibold">Informer le client</div>
          <div className="text-sm text-gray-600">
            Message prêt à l’envoi. Tu peux l’envoyer par SMS ou le copier.
          </div>
        </div>
        <button aria-label="Fermer" className="text-gray-500 hover:text-black" onClick={() => setMsgDialog(null)}>✕</button>
      </div>

      <div className="mt-4 p-3 rounded-xl border bg-gray-50 text-sm">
        Bonjour, Sportminedor vous informe que votre raquette est cordée et que vous pouvez venir la récupérer.
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="px-4 h-10 rounded-xl border bg-white hover:bg-gray-50"
          onClick={async () => {
            const msg = "Bonjour, Sportminedor vous informe que votre raquette est cordée et que vous pouvez venir la récupérer.";
            const tel = (msgDialog.phone || "").trim();
            if (tel) {
              const smsUrl = `sms:${encodeURIComponent(tel)}?&body=${encodeURIComponent(msg)}`;
              window.open(smsUrl, "_blank");
            } else {
              try { await navigator.clipboard.writeText(msg); alert("Pas de numéro trouvé. Message copié dans le presse-papiers."); } catch {}
            }
          }}
        >
          Envoyer le SMS
        </button>

        <button
          type="button"
          className="px-4 h-10 rounded-xl border bg-white hover:bg-gray-50"
          onClick={async () => {
            const msg = "Bonjour, Sportminedor vous informe que votre raquette est cordée et que vous pouvez venir la récupérer.";
            try { await navigator.clipboard.writeText(msg); } catch {}
          }}
        >
          Copier le message
        </button>

        <button
          type="button"
          className="ml-auto px-4 h-10 rounded-xl bg-brand-red text-white hover:opacity-90"
          onClick={async () => {
            await markMessageSent(msgDialog.row);
            setMsgDialog(null);
          }}
        >
          Marquer comme envoyé
        </button>
      </div>
    </div>
  </div>
)}
{phoneDialog && (
  <div
    className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40"
    onClick={() => setPhoneDialog(null)}
  >
    <div
      className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none">📞</div>
        <div className="flex-1">
          <div className="text-lg font-semibold">Téléphone</div>
          <div className="text-sm text-gray-600">
            {phoneDialog.name || "Client"}
          </div>
        </div>
        <button
          aria-label="Fermer"
          className="text-gray-500 hover:text-black"
          onClick={() => setPhoneDialog(null)}
        >
          ✕
        </button>
      </div>

      <div className="mt-4 p-3 rounded-xl border bg-gray-50 text-sm">
        <div className="font-semibold">{phoneDialog.phone || "—"}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          className="px-4 h-10 rounded-xl border bg-white hover:bg-gray-50"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(phoneDialog.phone || "");
            } catch {}
          }}
          disabled={!phoneDialog.phone}
          title="Copier"
        >
          Copier
        </button>

        <button
          type="button"
          className="px-4 h-10 rounded-xl bg-brand-red text-white hover:opacity-90"
          onClick={() => {
            const tel = (phoneDialog.phone || "").trim();
            if (!tel) return;
            window.open(`tel:${tel.replace(/\s/g, "")}`, "_blank");
          }}
          disabled={!phoneDialog.phone}
          title="Appeler"
        >
          Appeler
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}