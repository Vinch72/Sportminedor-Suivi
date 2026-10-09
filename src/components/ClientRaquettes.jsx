// src/components/ClientRaquettes.jsx — raquettes d'un client (fiche client)
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { IconEdit, IconTrash } from "./ui/Icons";
import { raquetteLabel } from "../utils/raquettes";

const EMPTY = { brand: "", model: "", pref_cordage_id: "", pref_tension: "", notes: "" };

export default function ClientRaquettes({ clientId, cordages = [] }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | id
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  async function load() {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("raquettes")
      .select("id, brand, model, pref_cordage_id, pref_tension, notes, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  function startNew() { setForm(EMPTY); setErr(""); setEditing("new"); }
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
      ? await supabase.from("raquettes").insert({ ...payload, client_id: clientId })
      : await supabase.from("raquettes").update(payload).eq("id", editing);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setEditing(null);
    await load();
  }

  async function remove(r) {
    const { error } = await supabase.from("raquettes").delete().eq("id", r.id);
    setConfirmDel(null);
    if (error) { setErr(error.message); return; }
    setItems(prev => prev.filter(x => x.id !== r.id));
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-500">Raquettes {items.length > 0 && <span className="text-gray-400">({items.length})</span>}</div>
        {editing === null && (
          <button type="button" onClick={startNew} className="text-xs font-semibold text-brand-red hover:underline">+ Ajouter</button>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-gray-400">Chargement…</div>
      ) : (
        <div className="space-y-1.5">
          {items.length === 0 && editing === null && (
            <div className="text-xs text-gray-400">Aucune raquette enregistrée.</div>
          )}
          {items.map(r => editing === r.id ? null : (
            <div key={r.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <span aria-hidden>🏸</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{raquetteLabel(r)}</div>
                {(r.pref_cordage_id || r.pref_tension || r.notes) && (
                  <div className="text-xs text-gray-500 truncate">
                    {[r.pref_cordage_id, r.pref_tension && `${r.pref_tension} kg`, r.notes].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              {confirmDel === r.id ? (
                <>
                  <button type="button" onClick={() => remove(r)} className="px-2 h-8 rounded-lg text-xs font-bold text-white bg-red-600">Supprimer</button>
                  <button type="button" onClick={() => setConfirmDel(null)} className="px-2 h-8 rounded-lg text-xs border border-gray-200 text-gray-500">Annuler</button>
                </>
              ) : (
                <>
                  <button type="button" title="Modifier" onClick={() => startEdit(r)} className="icon-btn"><IconEdit /></button>
                  <button type="button" title="Supprimer" onClick={() => setConfirmDel(r.id)} className="icon-btn-red"><IconTrash /></button>
                </>
              )}
            </div>
          ))}

          {editing !== null && (
            <form onSubmit={save} className="rounded-xl border border-gray-200 p-3 space-y-2 bg-white">
              <div className="text-xs font-semibold text-gray-700">{editing === "new" ? "Nouvelle raquette" : "Modifier la raquette"}</div>
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded-lg p-2 text-sm" placeholder="Marque (ex: Yonex)" value={form.brand}
                  onChange={e => setForm(f => ({ ...f, brand: e.target.value.toUpperCase() }))} />
                <input className="border rounded-lg p-2 text-sm" placeholder="Modèle *" value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value.toUpperCase() }))} />
                <select className="border rounded-lg p-2 text-sm bg-white" value={form.pref_cordage_id} onChange={set("pref_cordage_id")}>
                  <option value="">Cordage préféré —</option>
                  {cordages.map(c => <option key={c.cordage} value={c.cordage}>{c.cordage}</option>)}
                </select>
                <input className="border rounded-lg p-2 text-sm" placeholder="Tension (ex: 11)" value={form.pref_tension} onChange={set("pref_tension")} />
              </div>
              <input className="w-full border rounded-lg p-2 text-sm" placeholder="Notes (optionnel)" value={form.notes} onChange={set("notes")} />
              {err && <div className="text-xs text-red-600">{err}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className="px-3 h-8 rounded-lg text-xs border border-gray-200 text-gray-500">Annuler</button>
                <button type="submit" disabled={saving} className="px-3 h-8 rounded-lg text-xs font-bold text-white bg-brand-red disabled:opacity-50">
                  {saving ? "…" : "Enregistrer"}
                </button>
              </div>
            </form>
          )}
          {err && editing === null && <div className="text-xs text-red-600">{err}</div>}
        </div>
      )}
    </div>
  );
}
