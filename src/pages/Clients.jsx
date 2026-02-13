// src/pages/Clients.jsx
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../utils/supabaseClient";
import logo from "../assets/sportminedor-logo.png"

// === Helpers (declare BEFORE component to avoid TDZ) ===
function normStr(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sortByNomPrenom(arr) {
  return [...(arr || [])].sort((a, b) => {
    const an = normStr(a?.nom);
    const bn = normStr(b?.nom);
    if (an < bn) return -1;
    if (an > bn) return 1;
    const ap = normStr(a?.prenom);
    const bp = normStr(b?.prenom);
    if (ap < bp) return -1;
    if (ap > bp) return 1;
    return 0;
  });
}

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

/* ===== Page ===== */
export default function Clients() {
  // listes
  const [clients, setClients] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [cordages, setCordages] = useState([]);

  const STEP = 36; // 36 cartes d’un coup
  const [visibleCount, setVisibleCount] = useState(STEP);

  // modal de suppression
  const [deleteDialog, setDeleteDialog] = useState(null); // { id, nom, prenom, cordage, tension, club }

  // formulaire (création / édition)
  const [editingId, setEditingId] = useState(null);
  const isEdit = !!editingId;

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [tension, setTension] = useState("");
  const [cordage, setCordage] = useState("");
  const [club, setClub] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // recherche
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
  setVisibleCount(STEP);
}, [query]);

  // modal détail + notes
  const [selected, setSelected] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // chargement des lookups + clients
  async function loadAll() {
    setLoading(true); setErr("");
    try {
      const [clb, crd, cls] = await Promise.all([
        supabase.from("clubs").select("clubs").order("clubs"),
        supabase.from("cordages").select("cordage").order("cordage"),
        supabase.from("clients").select("*").order("nom").order("prenom"),
      ]);
      const firstErr = [clb, crd, cls].find(r => r.error)?.error;
      if (firstErr) throw firstErr;

      setClubs(clb.data || []);
      setCordages(crd.data || []);
      setClients(sortByNomPrenom(cls.data || []));
    } catch (e) {
      setErr(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  const t = setTimeout(() => setQuery(queryInput), 150); // 150-250ms = bien
  return () => clearTimeout(t);
}, [queryInput]);

  useEffect(() => { loadAll(); }, []);

  // helpers
  const cordagesList = useMemo(() => cordages.map(c => c.cordage), [cordages]);
  const clubsList = useMemo(() => clubs.map(c => c.clubs), [clubs]);
  const notePreview = (s) => {
    if (!s) return null;
    const t = String(s).trim();
    if (!t) return null;
    return t.length > 90 ? t.slice(0, 90) + "…" : t;
  };

  const filteredClients = useMemo(() => {
    const list = clients || [];
    const q = normStr(query);
  
    // Toujours renvoyer une liste triée
    if (!q) return sortByNomPrenom(list);
  
    const out = list.filter((c) => {
      const nom = normStr(c.nom);
      const prenom = normStr(c.prenom);
      const full1 = normStr(`${c.nom || ""} ${c.prenom || ""}`);
      const full2 = normStr(`${c.prenom || ""} ${c.nom || ""}`);
      const club = normStr(c.club);
      const phone = normStr(c.phone || c.telephone || c.tel || c.mobile);
      const email = normStr(c.email);
      return (
        nom.includes(q) ||
        prenom.includes(q) ||
        full1.includes(q) ||
        full2.includes(q) ||
        club.includes(q) ||
        phone.includes(q) ||
        email.includes(q)
      );
    });
  
    return sortByNomPrenom(out);
  }, [clients, query]);

  const visibleClients = useMemo(
  () => filteredClients.slice(0, visibleCount),
  [filteredClients, visibleCount]
);  
  
  function resetForm() {
    setEditingId(null);
    setNom(""); setPrenom("");
    setTension(""); setCordage(""); setClub("");
    setPhone(""); setEmail("");
  }

  function fillFormFromClient(c) {
    setEditingId(c.id);
    setNom(c.nom || "");
    setPrenom(c.prenom || "");
    setTension(c.tension || "");
    setCordage(c.cordage || "");
    setClub(c.club || "");
    setPhone(c.phone || c.telephone || "");
    setEmail(c.email || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      if (!nom?.trim() || !prenom?.trim()) {
        throw new Error("Nom et prénom sont requis.");
      }
      const payload = {
        nom: nom.trim(),
        prenom: prenom.trim(),
        tension: tension || null,
        cordage: cordage || null,
        club: club || null,            // ✅ ta colonne "club" dans clients
        phone: phone || null,          // champs optionnels
        email: email || null,
      };

      if (isEdit) {
        const { data, error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", editingId)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        setClients(prev => sortByNomPrenom(prev.map(c => (c.id === editingId ? data : c))));
        window.dispatchEvent(new CustomEvent("clients:updated", { detail: { id: editingId }}));
        resetForm();
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .insert(payload)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      setClients(prev => sortByNomPrenom([...(prev || []), data]));
      window.dispatchEvent(new CustomEvent("clients:updated", { detail: { id: data.id }}));
      resetForm();
    } catch (e) {
      setErr(e.message || "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }
  async function reallyDeleteClient() {
    if (!deleteDialog) return setDeleteDialog(null);
    const c = deleteDialog;
  
    // 1) figer le nom dans toutes les lignes de suivi de ce client
    try {
      await supabase
        .from("suivi")
        .update({
          client_nom: c.nom || null,
          client_prenom: c.prenom || null,
        })
        .eq("client_id", c.id);
    } catch (e) {
      console.warn("Snapshot nom/prenom avant suppression client:", e);
      // on continue quand même
    }
  
    // 2) supprimer la fiche client
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) {
      alert("Suppression refusée (RLS ?)");
      return;
    }
    setClients(prev => sortByNomPrenom(prev.filter(x => x.id !== c.id)));
    if (selected?.id === c.id) setSelected(null);
    window.dispatchEvent(new CustomEvent("clients:updated", { detail: { id: c.id }}));
    setDeleteDialog(null);
  }
  
  function onDeleteClient(c) {
    // ouvre la modale "supprimer"
    setDeleteDialog(c);
  }
  
  async function saveNotes() {
    if (!selected) return;
    setSavingNotes(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .update({ notes: notesDraft ?? null })
        .eq("id", selected.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      setClients(prev => prev.map(c => c.id === selected.id ? data : c));
      setSelected(data); // refléter la note sauvegardée
      window.dispatchEvent(new CustomEvent("clients:updated", { detail: { id: selected.id }}));
      setNotesSaved(true);
setTimeout(() => setNotesSaved(false), 2000); // revient à l’état normal après 2s
    } catch (e) {
      alert(e.message || "Erreur à l'enregistrement des notes");
    } finally {
      setSavingNotes(false);
    }
  }

  // rendu
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <img
          src={logo}
          alt=""
          className="h-8 w-8 rounded-full select-none"
        />
        <span>Gestion des Clients</span>
    </h1>

      {/* Formulaire rouge/noir */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100">
        <div className="px-5 py-4 border-b bg-brand-dark text-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{isEdit ? "Modifier le client" : "Ajouter un nouveau client"}</div>
            {isEdit && (
              <button
                onClick={resetForm}
                className="text-sm underline decoration-brand-red hover:opacity-90"
              >
                Annuler l’édition
              </button>
            )}
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Nom" required>
            <input className="w-full border rounded-lg p-2" value={nom} onChange={e=>setNom(e.target.value)} />
          </Field>
          <Field label="Prénom" required>
            <input className="w-full border rounded-lg p-2" value={prenom} onChange={e=>setPrenom(e.target.value)} />
          </Field>
          <Field label="Tension">
            <input className="w-full border rounded-lg p-2" placeholder="ex: 11-11,5" value={tension} onChange={e=>setTension(e.target.value)} />
          </Field>
          <Field label="Cordage">
            <select className="w-full border rounded-lg p-2" value={cordage} onChange={e=>setCordage(e.target.value)}>
              <option value="">—</option>
              {cordagesList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Club">
            <select className="w-full border rounded-lg p-2" value={club} onChange={e=>setClub(e.target.value)}>
              <option value="">—</option>
              {clubsList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Téléphone (optionnel)">
            <input className="w-full border rounded-lg p-2" value={phone} onChange={e=>setPhone(e.target.value)} />
          </Field>
          <Field label="Email (optionnel)">
            <input type="email" className="w-full border rounded-lg p-2" value={email} onChange={e=>setEmail(e.target.value)} />
          </Field>

          {err && <div className="md:col-span-2 lg:col-span-3 text-red-600">{err}</div>}

          <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-brand-red text-white disabled:opacity-50"
            >
              {saving ? (isEdit ? "Mise à jour…" : "Ajout…") : (isEdit ? "Mettre à jour" : "Ajouter")}
            </button>
          </div>
        </form>
      </div>

      {/* Recherche client */}
<div className="mt-6">
  <label className="block text-sm text-gray-600 mb-1">Rechercher un client</label>
  <div className="relative">
    {/* icône centrée */}
    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </div>

    <input
      type="text"
      value={queryInput}
      onChange={(e) => setQueryInput(e.target.value)}
      placeholder="Nom, prénom, club, téléphone ou email…"
      className="w-full h-11 pl-10 pr-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-red"
    />
  </div>
</div>

{/* Liste des clients */}
<div className="mt-8">
  <h2 className="text-lg font-semibold mb-3">Clients existants</h2>

  {loading ? (
    <div className="text-gray-500">Chargement…</div>
  ) : filteredClients.length === 0 ? (
    <div className="text-gray-500">Aucun résultat.</div>
  ) : (
    <>
      <ul className="list-none grid gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {visibleClients.map((c) => (
          <li key={c.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelected(c);
                setNotesDraft(c.notes ?? "");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(c);
                  setNotesDraft(c.notes ?? "");
                }
              }}
              className="
               flex w-full rounded-2xl border border-gray-200 bg-white shadow-sm
               hover:shadow-md hover:border-gray-300 hover:-translate-y-[1px]
               transition will-change-transform cursor-pointer overflow-hidden
              "
            >
              {/* Liseré gauche */}
              <div className="w-1.5 bg-[#E10600]" />

              <div className="flex-1 p-4 min-w-0">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-brand-dark truncate">
                      {[c.prenom, c.nom].filter(Boolean).join(" ")}
                    </div>

                    {/* Cordage + Tension (tags) */}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full border bg-gray-50 font-medium text-gray-800">
                        {c.cordage || "—"}
                      </span>

                      {c.tension ? (
                        <span className="px-2.5 py-1 rounded-full border border-red-200 bg-red-50 text-red-700 font-semibold">
                          {c.tension}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Modifier"
                        onClick={(e) => {
                          e.stopPropagation();
                          fillFormFromClient(c);
                        }}
                        className="p-2 rounded-full hover:bg-gray-100"
                      >
                        <IconEdit />
                      </button>

                      <button
                        type="button"
                        title="Supprimer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteClient(c);
                        }}
                        className="p-2 rounded-full hover:bg-red-100 text-red-600"
                      >
                        <IconTrash />
                      </button>
                    </div>

                    {/* Note sous les boutons, à droite */}
                    {c.notes ? (
                      <div className="mt-2 text-[11px] text-gray-500 italic text-right">
                        {notePreview(c.notes)}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Infos contact */}
                {(c.club || c.phone || c.email) ? (
                  <div className="mt-3 space-y-1 text-xs text-gray-600">
                    {c.club ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-blue-600 shrink-0">🛡️</span>
                        <span className="truncate">{c.club}</span>
                      </div>
                    ) : null}

                    {c.phone ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0">📞</span>
                        <span className="truncate">{c.phone}</span>
                      </div>
                    ) : null}

                    {c.email ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0">@</span>
                        <span className="truncate">{c.email}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {filteredClients.length > visibleCount && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="px-4 h-10 rounded-xl border bg-white hover:bg-gray-50 text-sm"
            onClick={() =>
              setVisibleCount((v) => Math.min(v + STEP, filteredClients.length))
            }
          >
            Charger plus ({visibleCount}/{filteredClients.length})
          </button>
        </div>
      )}
    </>
  )}
</div>

      {/* Popup détail + notes */}
      {selected && (
        <Modal onClose={() => setSelected(null)} title="Fiche client">
          <Detail label="Nom" value={selected.nom ?? "—"} />
          <Detail label="Prénom" value={selected.prenom ?? "—"} />
          <Detail label="Tension" value={selected.tension ?? "—"} />
          <Detail label="Cordage" value={selected.cordage ?? "—"} />
          <Detail label="Club" value={selected.club ?? "—"} />
          <Detail label="Téléphone" value={selected.phone ?? selected.telephone ?? "—"} />
          <Detail label="Email" value={selected.email ?? "—"} />

          <div className="mt-4">
            <div className="text-sm text-gray-500 mb-1">Notes</div>
            <textarea
              rows={2}
              className="w-full border rounded-lg p-2"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Note libre…"
            />
            <div className="mt-2 text-right">
            <button
  type="button"
  onClick={saveNotes}
  disabled={savingNotes}
  className="px-4 py-2 rounded-lg bg-brand-red text-white disabled:opacity-50"
>
  {savingNotes ? "Enregistrement…" : notesSaved ? "Enregistré ✓" : "Enregistrer la note"}
</button>

            </div>
          </div>
        </Modal>
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
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold">Supprimer ce client&nbsp;?</div>
          <div className="mt-1 text-sm text-gray-600">
            <div className="truncate">
              <b>
                {[deleteDialog.prenom, deleteDialog.nom].filter(Boolean).join(" ")}
              </b>
            </div>
            {(deleteDialog.cordage || deleteDialog.tension) && (
              <div className="truncate">
                {deleteDialog.cordage || "—"}
                {deleteDialog.tension ? ` • ${deleteDialog.tension}` : ""}
              </div>
            )}
            {deleteDialog.club && <div>Club : {deleteDialog.club}</div>}
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

      <div className="mt-3 p-3 rounded-xl border bg-gray-50 text-sm">
        Cette action est <b>définitive</b>. Les lignes de suivi existantes liées à ce
        client ne seront pas supprimées automatiquement.
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
          onClick={reallyDeleteClient}
        >
          Supprimer
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}

/* ===== UI helpers ===== */
function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-600">{label}{required ? " *" : ""}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b">
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{String(value ?? "—")}</div>
    </div>
  );
}
function Modal({ title, children, onClose }) {
  // Échap + bloque le scroll de la page
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[10000]">
      {/* Backdrop cliquable */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Carte centrée, étroite et pas trop haute */}
      <div className="absolute inset-0 flex items-center justify-center px-3">
        <div
          className="
            relative bg-white shadow-card rounded-2xl
            w-[92vw] max-w-[24rem]      /* étroit sur desktop et mobile */
            sm:max-w-[26rem] md:max-w-[30rem]
            max-h-[78vh]                /* contenu scrolle */
            overflow-hidden flex flex-col
          "
        >
          {/* Header sticky */}
          <div className="sticky top-0 bg-white px-4 py-2.5 border-b flex items-center justify-between">
            <h3 className="font-semibold text-base">{title}</h3>
            <button onClick={onClose} className="text-gray-600 hover:text-black">✕</button>
          </div>

          {/* Contenu scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 text-sm break-words min-w-0">
            {children}
          </div>

          {/* Footer sticky – utile sur mobile */}
          <div className="sticky bottom-0 bg-white px-4 py-2.5 border-t text-right sm:hidden">
            <button onClick={onClose} className="px-4 py-2 rounded border">Fermer</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}