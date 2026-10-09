// src/components/ClientRaquettes.jsx — fenêtre "Raquettes" d'un client (style Stringflow)
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../utils/supabaseClient";
import { IconEdit, IconTrash } from "./ui/Icons";
import { raquetteLabel } from "../utils/raquettes";

const EMPTY = { brand: "", model: "", pref_cordage_id: "", pref_tension: "", notes: "" };

export default function RaquettesModal({ client, cordages = [], onClose }) {
  const clientName = [client?.prenom, client?.nom].filter(Boolean).join(" ");
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(null); // null | "new" | id
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");
  const [deleteRq, setDeleteRq] = useState(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("raquettes")
      .select("id, brand, model, pref_cordage_id, pref_tension, notes, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [client.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function startNew() { setForm(EMPTY); setErr(""); setEditing(editing === "new" ? null : "new"); }
  function startEdit(r) {
    setForm({
      brand: r.brand || "", model: r.model || "", pref_cordage_id: r.pref_cordage_id || "",
      pref_tension: r.pref_tension || "", notes: r.notes || "",
    });
    setErr(""); setEditing(r.id);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.model.trim()) { setErr("Modèle requis."); return; }
    setSaving(true); setErr("");
    const payload = {
      brand: form.brand.trim().toUpperCase() || null,
      model: form.model.trim().toUpperCase(),
      pref_cordage_id: form.pref_cordage_id || null,
      pref_tension: form.pref_tension.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing === "new"
      ? await supabase.from("raquettes").insert({ ...payload, client_id: client.id })
      : await supabase.from("raquettes").update(payload).eq("id", editing);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setEditing(null);
    await load();
  }

  async function reallyDelete() {
    const target = deleteRq;
    const { error } = await supabase.from("raquettes").delete().eq("id", target.id);
    setDeleteRq(null);
    if (error) { setErr(error.message); return; }
    setItems(prev => prev.filter(x => x.id !== target.id));
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setUpper = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value.toUpperCase() }));

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center modal-overlay p-3" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* En-tête */}
        <div className="px-5 py-4 border-b bg-gray-900 text-white flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="font-semibold text-lg">🏸 Raquettes</div>
            <div className="text-sm opacity-70 truncate">{clientName}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={startNew}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white border border-white/30 hover:bg-white/10">
              {editing === "new" ? "Annuler" : "+ Ajouter"}
            </button>
            <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 rounded hover:bg-white/10 text-white">✕</button>
          </div>
        </div>

        {/* Formulaire ajout / édition */}
        {editing !== null && (
          <form onSubmit={save} className="border-b bg-gray-50 p-4 space-y-2 shrink-0">
            <div className="text-xs font-semibold text-gray-700">{editing === "new" ? "Nouvelle raquette" : "Modifier la raquette"}</div>
            <div className="grid grid-cols-2 gap-2">
              <input className="border rounded-lg p-2 text-sm bg-white" placeholder="Marque (ex: Yonex)" value={form.brand} onChange={setUpper("brand")} />
              <input className="border rounded-lg p-2 text-sm bg-white" placeholder="Modèle *" value={form.model} onChange={setUpper("model")} autoFocus />
              <select className="border rounded-lg p-2 text-sm bg-white" value={form.pref_cordage_id} onChange={set("pref_cordage_id")}>
                <option value="">Cordage préféré —</option>
                {cordages.map(c => <option key={c.cordage} value={c.cordage}>{c.cordage}</option>)}
              </select>
              <input className="border rounded-lg p-2 text-sm bg-white" placeholder="Tension (ex: 11)" value={form.pref_tension} onChange={set("pref_tension")} />
            </div>
            <input className="w-full border rounded-lg p-2 text-sm bg-white" placeholder="Notes (optionnel)" value={form.notes} onChange={set("notes")} />
            {err && <div className="text-xs text-red-600">{err}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-3 h-9 rounded-lg text-sm border border-gray-200 text-gray-500 bg-white">Annuler</button>
              <button type="submit" disabled={saving} className="px-4 h-9 rounded-lg text-sm font-bold text-white bg-brand-red disabled:opacity-50">
                {saving ? "…" : "Enregistrer"}
              </button>
            </div>
          </form>
        )}

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="text-gray-500 text-sm">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-3">🏸</div>
              <div className="text-sm">Aucune raquette enregistrée pour ce client.</div>
              {editing === null && (
                <button type="button" onClick={startNew} className="mt-3 text-sm underline text-brand-red">
                  Ajouter la première raquette
                </button>
              )}
            </div>
          ) : items.map(rq => (
            <div key={rq.id} className="rounded-xl border bg-white p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">🏸</span>
                  <span className="font-semibold text-gray-900">{raquetteLabel(rq) || "Raquette sans nom"}</span>
                </div>
                {(rq.pref_cordage_id || rq.pref_tension || rq.notes) && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    {rq.pref_cordage_id && <span>🧵 {rq.pref_cordage_id}</span>}
                    {rq.pref_tension && <span>⚡ {rq.pref_tension} kg</span>}
                    {rq.notes && <span className="text-gray-400 italic">📝 {rq.notes}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" title="Modifier" onClick={() => startEdit(rq)} className="p-2 rounded-full hover:bg-gray-100"><IconEdit /></button>
                <button type="button" title="Supprimer" onClick={() => setDeleteRq(rq)} className="p-2 rounded-full hover:bg-red-100 text-red-600"><IconTrash /></button>
              </div>
            </div>
          ))}
          {err && editing === null && <div className="text-xs text-red-600">{err}</div>}
        </div>

        {/* Confirmation suppression */}
        {deleteRq && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center modal-overlay p-4" onClick={() => setDeleteRq(null)}>
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="text-lg font-semibold mb-2">🗑️ Supprimer cette raquette ?</div>
              <div className="text-sm text-gray-600">
                <b>{raquetteLabel(deleteRq)}</b> sera retirée de la fiche. Le suivi garde le nom de la raquette.
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="px-4 h-10 rounded-xl text-sm border border-gray-200 text-gray-600" onClick={() => setDeleteRq(null)}>Annuler</button>
                <button type="button" className="px-4 h-10 rounded-xl text-sm font-bold text-white bg-red-600" onClick={reallyDelete}>Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
