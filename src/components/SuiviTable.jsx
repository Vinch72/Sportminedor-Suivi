// src/components/SuiviTable.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

/* ===== Icônes ===== */
function IconEdit(props){
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         className="w-4 h-4" {...props}>
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  );
}
function IconTrash(props){
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         className="w-4 h-4" {...props}>
      <path d="M3 6h18"/>
      <path d="M8 6v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>
  );
}

/* ===== Select Statut inline ===== */
function InlineStatutSelect({ value, onChange, options, disabled, ...rest }) {
  return (
    <select
      className="border rounded px-2 py-1 text-sm bg-white"
      value={value || ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    >
      {options.map((s) => (
        <option key={s.statut_id} value={s.statut_id}>
          {s.statut_id}
        </option>
      ))}
    </select>
  );
}

const PAGE_SIZE = 25;

const PAYMENT_OPTIONS = ["CB", "Especes", "Chèque", "Virement"];
const isPAYE = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase() === "PAYE";

const stop = (e) => {
  e?.preventDefault?.();
  e?.stopPropagation?.();
};

// ✅ n'utilise plus "load" ; on fera un refresh optimiste via setRows passé en callback
async function setPaymentDB(id, mode) {
  const patch = {
    reglement_mode: mode || null,
    reglement_date: mode ? new Date().toISOString() : null,
  };
  const { error } = await supabase.from("suivi").update(patch).eq("id", id);
  if (error) throw error;
}

// prompt qui accepte un callback "after(mode)" pour MAJ locale
async function promptPayment(row, after) {
  const current = row.reglement_mode || "";
  const mode = window.prompt(
    "Mode de règlement ? (CB / Especes / Chèque / Virement)",
    current
  );
  if (!mode) return; // annulé
  const norm = mode.trim();
  if (!PAYMENT_OPTIONS.includes(norm)) {
    alert("Valeur invalide. Utiliser: CB / Especes / Chèque / Virement");
    return;
  }
  await setPaymentDB(row.id, norm);
  after?.(norm); // MAJ locale immédiate
}

export default function SuiviTable({ onEdit }) {
  const [rows, setRows] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);
  const [statuts, setStatuts] = useState([]);
  const stop = (e) => e.stopPropagation();

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  /* ===== Statuts (pour le select inline) ===== */
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("statuts")
        .select("statut_id")
        .order("statut_id");
      if (!error && alive) setStatuts(data || []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function updateRowStatut(id, newStatut) {
    // Optimiste
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              statut_id: newStatut,
              ...(isPAYE(newStatut) ? { reglement_date: new Date().toISOString() } : {}),
            }
          : r
      )
    );
  
    const patch = { statut_id: newStatut };
    if (isPAYE(newStatut)) patch.reglement_date = new Date().toISOString();
  
    const { error } = await supabase.from("suivi").update(patch).eq("id", id);
    if (error) {
      console.error(error);
      alert("Mise à jour du statut refusée.");
      // (facultatif) déclenche ton mécanisme de reload global si tu en as un
      window.dispatchEvent(new CustomEvent("suivi:updated"));
    }
  }  

  async function onDeleteRow(row) {
    const ok = window.confirm("Voulez-vous vraiment supprimer cette ligne de Suivi ?");
    if (!ok) return;
    if (!row?.id) {
      alert("Suppression impossible : id introuvable.");
      return;
    }
    const { error } = await supabase.from("suivi").delete().eq("id", row.id);
    if (error) {
      console.error("Delete error:", error);
      alert("Suppression refusée (RLS/permissions ?).");
      return;
    }
    // UI: enlève localement + ajuste le compteur
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setCount((c) => Math.max(0, c - 1));
    window.dispatchEvent(new CustomEvent("suivi:deleted", { detail: { id: row.id } }));
  }

  /* ===== lookups ===== */
  const [clients, setClients] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [cordages, setCordages] = useState([]);
  const [cordeurs, setCordeurs] = useState([]);

  /* ===== écoute des events pour recharger ===== */
  useEffect(() => {
    const onCreated = () => setReloadKey((k) => k + 1);
    const onUpdated = () => setReloadKey((k) => k + 1);
    const onDeleted = () => setReloadKey((k) => k + 1);
    window.addEventListener("suivi:created", onCreated);
    window.addEventListener("suivi:updated", onUpdated);
    window.addEventListener("suivi:deleted", onDeleted);
    return () => {
      window.removeEventListener("suivi:created", onCreated);
      window.removeEventListener("suivi:updated", onUpdated);
      window.removeEventListener("suivi:deleted", onDeleted);
    };
  }, []);

  /* ===== Realtime (INSERT) ===== */
  useEffect(() => {
    const ch = supabase
      .channel("suivi-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "suivi" }, () =>
        setReloadKey((k) => k + 1)
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  /* ===== Chargement des données ===== */
  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const [cl, cb, co, cr] = await Promise.all([
          supabase.from("clients").select("id, nom, prenom"),
          supabase.from("clubs").select("clubs, bobine_base, bobine_specific"),
          supabase.from("cordages").select("cordage, is_base"),
          supabase.from("cordeur").select("cordeur"),
        ]);
        if (cl.error) throw cl.error;
        if (cb.error) throw cb.error;
        if (co.error) throw co.error;
        if (cr.error) throw cr.error;

        if (!ignore) {
          setClients(cl.data || []);
          setClubs(cb.data || []);
          setCordages(co.data || []);
          setCordeurs(cr.data || []);
        }

        const { data, error, count: total } = await supabase
          .from("suivi")
          .select("*", { count: "exact" })
          .order("date", { ascending: false })
          .order("id",   { ascending: true })
          .range(from, to);

        if (error) throw error;

        if (!ignore) {
          setRows(data || []);
          setCount(total ?? 0);
        }
      } catch (e) {
        if (!ignore) setErr(e.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [from, to, reloadKey]);

  /* ===== maps labels ===== */
  const clientsMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const clubsMap = useMemo(() => Object.fromEntries(clubs.map((c) => [c.clubs, c])), [clubs]);
  const cordagesMap = useMemo(() => Object.fromEntries(cordages.map((c) => [c.cordage, c])), [cordages]);
  const cordeursMap = useMemo(() => Object.fromEntries(cordeurs.map((c) => [c.cordeur, c])), [cordeurs]);

  /* ===== helpers affichage ===== */
  const fmtDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return String(d);
    }
  };

  const fmtEuro = (v) => {
    if (v == null || v === "") return "—";
    // enlève tout sauf chiffres / , .
    const n = typeof v === "number"
      ? v
      : parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
    if (!isFinite(n)) return String(v); // fallback si pas parseable
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  };  

  const fullNameById = (id) => {
    const c = clientsMap[id];
    if (!c) return id || "—";
    return [c.prenom, c.nom].filter(Boolean).join(" ");
  };
  const clubLabel = (id) => clubsMap[id]?.clubs ?? id ?? "—";
  const cordageLabel = (id) => cordagesMap[id]?.cordage ?? id ?? "—";
  const cordeurLabel = (id) => cordeursMap[id]?.cordeur ?? id ?? "—";
  const ouiNon = (v) => (v ? "Oui" : "Non");

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Suivi — {count} lignes</h2>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded border disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            ◀
          </button>
          <span className="text-sm">
            Page {page + 1} / {totalPages}
          </span>
          <button
            className="px-3 py-1 rounded border disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
          >
            ▶
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-card border border-gray-100">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <Th>Date</Th>
              <Th>Statut</Th>
              <Th>Client</Th>
              <Th className="hidden md:table-cell">Raquette</Th>
              <Th className="hidden lg:table-cell">Club</Th>
              <Th className="hidden lg:table-cell">Cordage</Th>
              <Th>Tension</Th>
              <Th className="hidden md:table-cell">Couleur</Th>
              <Th>Tarif</Th>
              <Th>Règlement</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-gray-500" colSpan={10}>
                  Chargement…
                </td>
              </tr>
            ) : err ? (
              <tr>
                <td className="p-4 text-red-600" colSpan={10}>
                  Erreur : {err}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-4 text-gray-500" colSpan={10}>
                  Aucune ligne.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
  key={r.id}
  onClick={(e) => {
    // Si le clic vient d'une cellule marquée "no-open", on n'ouvre PAS le modal
    if (e.target.closest('[data-no-open="true"]')) return;
    setSelected(r);
  }}
  className="hover:bg-gray-50 cursor-pointer"
>
                  {/* 1. Date */}
                  <Td>{fmtDate(r.date)}</Td>

                  {/* 2. Statut */}
                  <Td data-no-open="true" onClick={stop}>
                  <InlineStatutSelect
  value={r.statut_id}
  options={statuts}
  onChange={async (val) => {
    const needPrompt = isPAYE(val) && !r.reglement_mode; // état avant update
    await updateRowStatut(r.id, val);
    if (needPrompt) {
      // MAJ locale immédiate quand l’utilisateur choisit un mode
      await promptPayment(r, (mode) =>
        setRows((prev) =>
          prev.map((x) =>
            x.id === r.id
              ? { ...x, reglement_mode: mode, reglement_date: new Date().toISOString() }
              : x
          )
        )
      );
    }
  }}
  onClick={stop}
  onMouseDown={stop}
  onTouchStart={stop}
/>

</Td>

                  {/* 3. Client */}
                  <Td>{fullNameById(r.client_id)}</Td>

                  {/* 4. Raquette */}
                  <Td className="hidden md:table-cell">{r.raquette ?? r.Raquette ?? "—"}</Td>

                  {/* 5. Club */}
                  <Td className="hidden lg:table-cell">{clubLabel(r.club_id)}</Td>

                  {/* 6. Cordage */}
                  <Td className="hidden lg:table-cell">{cordageLabel(r.cordage_id)}</Td>

                  {/* 7. Tension */}
                  <Td>{r.tension ?? "—"}</Td>

                  {/* 8. Couleur */}
                  <Td className="hidden md:table-cell">{r.couleur ?? "—"}</Td>

                  {/* 9. Tarif */}
                  <Td>{fmtEuro(r.tarif)}</Td>

                  {/* 10. Règlement (mode + bouton) */}
                  <Td data-no-open="true" onClick={stop}>
  <div className="flex items-center gap-2">
    <span className="text-sm">{r.reglement_mode || "—"}</span>
    <button
      type="button"
      className="p-1.5 rounded hover:bg-gray-100"
      title="Définir / modifier le mode"
      onClick={(e) => {
        stop(e);
        promptPayment(r, (mode) =>
          setRows((prev) =>
            prev.map((x) =>
              x.id === r.id
                ? { ...x, reglement_mode: mode, reglement_date: new Date().toISOString() }
                : x
            )
          )
        );
      }}
    >
      💳
    </button>
  </div>
</Td>


                  {/* 11. Actions */}
                  <Td data-no-open="true" onClick={stop}>
  <div className="flex items-center gap-1">
    <button
      type="button"
      title="Modifier"
      onClick={(e) => { stop(e); onEdit && onEdit(r); }}
      className="p-2 rounded-full hover:bg-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
    >
      <IconEdit />
    </button>
    <button
      type="button"
      title="Supprimer"
      onClick={(e) => { stop(e); onDeleteRow(r); }}
      className="p-2 rounded-full hover:bg-red-100 text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
    >
      <IconTrash />
    </button>
  </div>
</Td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal détail */}
      {selected && (
        <Modal onClose={() => setSelected(null)} title="Détail du suivi">
          <DetailRow label="Date" value={fmtDate(selected.date)} />
          <DetailRow label="Statut" value={selected.statut_id ?? "—"} />
          <DetailRow label="Client" value={fullNameById(selected.client_id)} />
          <DetailRow label="Club" value={clubLabel(selected.club_id)} />
          <DetailRow label="Cordage" value={cordageLabel(selected.cordage_id)} />
          <DetailRow label="Cordeur" value={cordeurLabel(selected.cordeur_id)} />
          <DetailRow label="Raquette" value={selected.raquette ?? selected.Raquette ?? "—"} />
          <DetailRow label="Tension" value={selected.tension ?? "—"} />
          <DetailRow label="Couleur" value={selected.couleur ?? "—"} />
          <DetailRow label="Tarif" value={selected.tarif ?? "—"} />
          <DetailRow label="Cordage fourni" value={ouiNon(selected.fourni)} />
          <DetailRow label="Prestation offerte" value={ouiNon(selected.offert)} />
          <DetailRow label="Règlement" value={selected.reglement_mode ?? "—"} />
          <DetailRow label="Date règlement" value={fmtDate(selected.reglement_date)} />
          <DetailRow
            label="Lieu"
            value={selected.lieu_id ?? selected["Lieu Id"] ?? selected["Lieu"] ?? "—"}
          />
          <OtherFields selected={selected} />
        </Modal>
      )}
    </div>
  );
}

/* ===== UI helpers ===== */
function Th({ children, className = "" }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 border-t ${className}`}>{children}</td>;
}
function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b">
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{String(value ?? "—")}</div>
    </div>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h3 className="font-semibold">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-black">
              ✕
            </button>
          </div>
          <div className="p-5 space-y-1">{children}</div>
          <div className="px-5 py-3 border-t text-right">
            <button onClick={onClose} className="px-4 py-2 rounded border">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Détail: champs restants ===== */
function OtherFields({ selected }) {
  const shown = new Set([
    "id",
    "date",
    "statut_id",
    "client_id",
    "club_id",
    "cordage_id",
    "cordeur_id",
    "raquette",
    "Raquette",
    "tension",
    "couleur",
    "tarif",
    "fourni",
    "offert",
    "lieu_id",
    "Lieu Id",
    "Lieu",
  ]);

  const labelMap = {
    "Lieu Id": "Lieu",
    lieu_id: "Lieu",
  };

  const formatValue = (k, v) => {
    if (k === "fourni" || k === "offert") return v ? "Oui" : "Non";
    return v ?? "—";
  };

  const entries = Object.entries(selected)
    .filter(([k]) => !shown.has(k))
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return null;

  const toLabel = (key) =>
    labelMap[key] || key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  return (
    <div className="mt-4">
      <div className="text-sm text-gray-500 mb-1">Autres champs</div>
      <div className="border rounded-md divide-y">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-3 py-2">
            <div className="text-gray-500">{toLabel(k)}</div>
            <div className="font-mono text-sm break-all">{String(formatValue(k, v))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}