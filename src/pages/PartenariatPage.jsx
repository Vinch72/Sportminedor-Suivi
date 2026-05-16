// src/pages/PartenariatPage.jsx
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const STORE_ID = "sportminedor";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_CONFIG = {
  en_attente: { label: "En attente",  cls: "bg-yellow-100 text-yellow-800" },
  en_cours:   { label: "En cours",    cls: "bg-blue-100 text-blue-800"   },
  expedie:    { label: "Expédié",     cls: "bg-purple-100 text-purple-800" },
  livre:      { label: "Livré",       cls: "bg-green-100 text-green-800" },
  annule:     { label: "Annulé",      cls: "bg-gray-100 text-gray-500"   },
};

const TYPE_CONFIG = {
  textile: { label: "Textile", icon: "👕" },
  volants: { label: "Volants", icon: "🏸" },
};

const TAILLES  = ["XS", "S", "M", "L", "XL", "XXL", "Unique"];
const VITESSES = [75, 76, 77, 78, 79];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const inputCls = "w-full h-10 px-3 rounded-xl text-sm text-gray-900 border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200";

function ConfirmModal({ title, message, confirmLabel = "Supprimer", onConfirm, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-[200]" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose} />
      <div className="fixed inset-0 z-[200] overflow-y-auto pointer-events-none">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-lg shrink-0">🗑️</div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                Annuler
              </button>
              <button type="button" onClick={async () => { await onConfirm(); onClose(); }}
                className="flex-1 h-10 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition">
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Modal ajout club ──────────────────────────────────────────────────────────
function AddClubModal({ onClose, onSuccess }) {
  const [form,      setForm]      = useState({ club_name: "", email: "", password: "", club_id: "" });
  const [clubsList, setClubsList] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    supabase.from("clubs").select("clubs, bobine_base, bobine_specific").order("clubs")
      .then(({ data }) => setClubsList(data || []));
  }, []);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.club_name.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Tous les champs sont obligatoires."); return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères."); return;
    }
    setLoading(true); setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data, error: fnErr } = await supabase.functions.invoke("create-partner-user", {
        body: {
          email:     form.email.trim().toLowerCase(),
          password:  form.password,
          club_name: form.club_name.trim(),
          store_id:  STORE_ID,
          club_id:   form.club_id || null,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Impossible de créer le compte.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Ajouter un club partenaire</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Nom du club</label>
            <input value={form.club_name} onChange={e => set("club_name", e.target.value)} placeholder="ex. TOAC Badminton" className={inputCls} /></div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Club associé <span className="text-gray-400 font-normal">(pour le suivi bobines)</span>
            </label>
            <select value={form.club_id} onChange={e => set("club_id", e.target.value)} className={inputCls}>
              <option value="">— Aucun club associé —</option>
              {clubsList.map(c => (
                <option key={c.clubs} value={c.clubs}>
                  {c.clubs}{(c.bobine_base || c.bobine_specific) ? " 🪡" : ""}
                </option>
              ))}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Email de connexion</label>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="ex. toac@sportminedor.com" className={inputCls} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe temporaire</label>
            <input type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="8 caractères minimum" className={inputCls} /></div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 h-10 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#E10600" }}>
              {loading ? "Création…" : "Créer le compte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal article catalogue ───────────────────────────────────────────────────
function CatalogItemModal({ type, item, onClose, onSuccess }) {
  const isEdit    = !!item;
  const isTextile = type === "textile";

  const [name,        setName]        = useState(item?.name        || "");
  const [description, setDescription] = useState(item?.description || "");
  const [prix,        setPrix]        = useState(item?.details?.prix || "");
  const [tailles,     setTailles]     = useState(item?.details?.tailles  || []);
  const [couleurs,    setCouleurs]    = useState((item?.details?.couleurs || []).join(", "));
  const [marque,      setMarque]      = useState(item?.details?.marque   || "");
  const [modele,      setModele]      = useState(item?.details?.modele   || "");
  const [vitesses,    setVitesses]    = useState(item?.details?.vitesses || []);

  const [imageUrl,     setImageUrl]     = useState(item?.image_url || "");
  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState(item?.image_url || "");
  const [uploading,    setUploading]    = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  function toggleTaille(t) {
    setTailles(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }
  function toggleVitesse(v) {
    setVitesses(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview("");
    setImageUrl("");
  }

  async function uploadImage(itemId) {
    if (!imageFile) return imageUrl;
    setUploading(true);
    const ext  = imageFile.name.split(".").pop();
    const path = `${STORE_ID}/${itemId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("partner-catalog")
      .upload(path, imageFile, { upsert: true });
    setUploading(false);
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("partner-catalog").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nom = isTextile ? name.trim() : `${marque.trim()} ${modele.trim()}`.trim();
    if (!nom) { setError("Le nom est obligatoire."); return; }

    const details = isTextile
      ? { tailles, couleurs: couleurs.split(",").map(s => s.trim()).filter(Boolean), prix: prix ? Number(prix) : undefined }
      : { marque: marque.trim(), modele: modele.trim(), vitesses, prix: prix ? Number(prix) : undefined };

    setLoading(true); setError("");
    try {
      if (isEdit) {
        const finalUrl = await uploadImage(item.id);
        const { error: err } = await supabase.from("partner_catalog")
          .update({ store_id: STORE_ID, type, name: nom, description: description.trim() || null, details, image_url: finalUrl || null })
          .eq("id", item.id);
        if (err) throw err;
      } else {
        const { data: inserted, error: err } = await supabase.from("partner_catalog")
          .insert({ store_id: STORE_ID, type, name: nom, description: description.trim() || null, details })
          .select("id").single();
        if (err) throw err;
        if (imageFile) {
          const finalUrl = await uploadImage(inserted.id);
          await supabase.from("partner_catalog").update({ image_url: finalUrl }).eq("id", inserted.id);
        }
      }
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">
            {isEdit ? "Modifier" : "Ajouter"} {isTextile ? "un article textile" : "un volant"}
          </h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Photo</label>
            {imagePreview ? (
              <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200">
                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={removeImage}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center text-xs hover:bg-black/70 transition">
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition">
                <span className="text-2xl mb-1">📷</span>
                <span className="text-xs text-gray-400">Cliquer pour ajouter une photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            )}
          </div>

          {isTextile ? (
            <>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Nom de l'article *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="ex. Maillot Club 2024" className={inputCls} /></div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Tailles disponibles</label>
                <div className="flex flex-wrap gap-2">
                  {TAILLES.map(t => (
                    <button key={t} type="button" onClick={() => toggleTaille(t)}
                      className={`h-8 px-3 rounded-lg text-xs font-medium border transition ${
                        tailles.includes(t) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Couleurs <span className="text-gray-400">(séparées par une virgule)</span></label>
                <input value={couleurs} onChange={e => setCouleurs(e.target.value)} placeholder="ex. Bleu marine, Blanc, Rouge" className={inputCls} /></div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Marque *</label>
                  <input value={marque} onChange={e => setMarque(e.target.value)} placeholder="Yonex, Victor…" className={inputCls} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Modèle</label>
                  <input value={modele} onChange={e => setModele(e.target.value)} placeholder="AS-20, AS-30…" className={inputCls} /></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Vitesses disponibles</label>
                <div className="flex gap-2">
                  {VITESSES.map(v => (
                    <button key={v} type="button" onClick={() => toggleVitesse(v)}
                      className={`h-8 w-10 rounded-lg text-xs font-medium border transition ${
                        vitesses.includes(v) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>{v}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div><label className="block text-xs font-medium text-gray-600 mb-1">Prix unitaire / carton (€)</label>
            <input type="number" min="0" step="0.01" value={prix} onChange={e => setPrix(e.target.value)} placeholder="ex. 25.00" className={inputCls} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-gray-400">(optionnel)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl text-sm border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" /></div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={loading || uploading} className="flex-1 h-10 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#E10600" }}>
              {uploading ? "Upload…" : loading ? "Enregistrement…" : isEdit ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal détail commande ─────────────────────────────────────────────────────
function OrderDetailModal({ order, partnerUsers, catalog, onClose, onStatusChange }) {
  const club    = partnerUsers.find(p => p.id === order.partner_user_id);
  const typeCfg = TYPE_CONFIG[order.type] || { label: order.type, icon: "📦" };
  const details = order.details || {};
  const [saving,     setSaving]     = useState(false);
  const [imgPreview, setImgPreview] = useState(false);

  const storeName  = "Sportminedor";
  const storeColor = "#E10600";

  const catalogItem  = catalog?.find(c => c.name === details.article && c.type === order.type);
  const prixUnitaire = catalogItem?.details?.prix ? Number(catalogItem.details.prix) : null;
  const quantite     = details.quantite ? Number(details.quantite) : null;
  const totalHT      = prixUnitaire && quantite ? prixUnitaire * quantite : null;

  function printInvoice() {
    const invoiceNum = `FAC-${order.id.slice(0, 8).toUpperCase()}`;
    const rows = Object.entries(details).map(([k, v]) =>
      `<tr><td>${k.replace(/_/g, " ")}</td><td>${Array.isArray(v) ? v.join(", ") : v}</td></tr>`
    ).join("");

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Facture ${invoiceNum}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; color: #111; padding: 48px; font-size: 14px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand { font-size: 22px; font-weight: 800; color: ${storeColor}; }
  .brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h1 { font-size: 26px; font-weight: 700; color: #111; }
  .invoice-meta .num { font-size: 13px; color: #6b7280; margin-top: 2px; }
  .invoice-meta .date { font-size: 13px; color: #6b7280; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 36px; }
  .party { background: #f9fafb; border-radius: 10px; padding: 16px; }
  .party-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; margin-bottom: 6px; }
  .party-name { font-size: 15px; font-weight: 700; }
  .party-detail { font-size: 12px; color: #6b7280; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: ${storeColor}; color: white; }
  thead th { text-align: left; padding: 10px 14px; font-size: 12px; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 10px 14px; font-size: 13px; text-transform: capitalize; }
  .totals { margin-left: auto; width: 260px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .totals-row.total { border-top: 2px solid #e5e7eb; margin-top: 4px; padding-top: 10px; font-size: 16px; font-weight: 800; color: ${storeColor}; }
  .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #9ca3af; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="header">
  <div><div class="brand">${storeName}</div><div class="brand-sub">Facture partenaire</div></div>
  <div class="invoice-meta">
    <h1>FACTURE</h1>
    <div class="num">${invoiceNum}</div>
    <div class="date">Date : ${fmtDate(order.created_at)}</div>
  </div>
</div>
<div class="parties">
  <div class="party"><div class="party-label">Émetteur</div><div class="party-name">${storeName}</div></div>
  <div class="party"><div class="party-label">Facturé à</div><div class="party-name">${club?.club_name || "Club"}</div>${club?.email ? `<div class="party-detail">${club.email}</div>` : ""}</div>
</div>
<table>
  <thead><tr><th>Désignation</th><th>Valeur</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  ${prixUnitaire ? `<div class="totals-row"><span>Prix unitaire</span><span>${prixUnitaire.toLocaleString("fr-FR")} €</span></div>` : ""}
  ${quantite ? `<div class="totals-row"><span>Quantité</span><span>×${quantite}</span></div>` : ""}
  ${totalHT !== null ? `<div class="totals-row total"><span>Total HT</span><span>${totalHT.toLocaleString("fr-FR")} €</span></div>` : ""}
</div>
<div class="footer">Document généré le ${new Date().toLocaleDateString("fr-FR")} — ${storeName}</div>
<script>window.onload = () => window.print();<\/script>
</body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  }

  async function changeStatus(newStatus) {
    setSaving(true);
    await supabase.from("partner_orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", order.id);
    if (newStatus !== "en_attente") {
      await supabase.from("partner_notifications").update({ read: true }).eq("order_id", order.id);
    }
    if (newStatus === "en_cours" || newStatus === "expedie") {
      await supabase.from("partner_deliveries").delete().eq("partner_order_id", order.id);
    }
    setSaving(false);
    onStatusChange?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 overflow-hidden" onClick={e => e.stopPropagation()}>
        {imgPreview && catalogItem?.image_url && (
          <div className="absolute inset-0 z-10 bg-white rounded-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
              <span className="text-sm font-medium text-gray-700">{catalogItem.name}</span>
              <button type="button" onClick={() => setImgPreview(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <img src={catalogItem.image_url} alt={catalogItem.name} className="max-w-full max-h-[60vh] object-contain rounded-xl" />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{typeCfg.icon}</span>
            <div>
              <h2 className="text-base font-bold">{typeCfg.label} — {club?.club_name || "Club"}</h2>
              <p className="text-xs text-gray-400">{fmtDate(order.created_at)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
        </div>

        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Statut :</span>
            <StatusBadge status={order.status} />
          </div>
          {order.notes && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700">
              <p className="text-xs font-medium text-gray-500 mb-1">Notes du club</p>
              {order.notes}
            </div>
          )}
          {Object.keys(details).length > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex gap-4">
              {catalogItem?.image_url && (
                <button type="button" onClick={() => setImgPreview(true)}
                  className="relative group shrink-0 self-start">
                  <img src={catalogItem.image_url} alt={catalogItem.name}
                    className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 group-hover:bg-black/30 transition">
                    <span className="text-white opacity-0 group-hover:opacity-100 text-lg transition">🔍</span>
                  </div>
                </button>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 mb-2">Détails de la commande</p>
                <dl className="space-y-1">
                  {Object.entries(details).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-sm">
                      <dt className="text-gray-500 capitalize">{k.replace(/_/g, " ")} :</dt>
                      <dd className="font-medium">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
        </div>

        {(prixUnitaire || quantite) && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs font-medium text-amber-700 mb-2">Facturation</p>
            <div className="space-y-1">
              {prixUnitaire && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Prix unitaire</span>
                  <span className="font-medium">{prixUnitaire.toLocaleString("fr-FR")} €</span>
                </div>
              )}
              {quantite && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Quantité</span>
                  <span className="font-medium">×{quantite}</span>
                </div>
              )}
              {totalHT !== null && (
                <div className="flex justify-between text-sm font-bold border-t border-amber-200 pt-1 mt-1">
                  <span className="text-amber-800">Total HT</span>
                  <span className="text-amber-800">{totalHT.toLocaleString("fr-FR")} €</span>
                </div>
              )}
              {!prixUnitaire && (
                <p className="text-xs text-amber-600 italic">Prix non renseigné dans le catalogue</p>
              )}
            </div>
          </div>
        )}

        <div className="border-t pt-4 mb-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Mettre à jour le statut</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button key={key} type="button" disabled={saving || order.status === key}
                onClick={() => changeStatus(key)}
                className={`px-3 h-8 rounded-lg text-xs font-medium border transition disabled:opacity-40 ${
                  order.status === key ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 bg-white hover:bg-gray-50"
                }`}>
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <button type="button" onClick={printInvoice}
            className="w-full h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 transition">
            🖨️ Générer la facture (PDF)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal accès clubs ─────────────────────────────────────────────────────────
function ClubAccessModal({ item, partnerUsers, onClose, onSuccess }) {
  const current  = item.partner_user_ids || [];
  const [selected, setSelected] = useState(current.map(String));
  const [saving,   setSaving]   = useState(false);

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from("partner_catalog").update({ partner_user_ids: selected }).eq("id", item.id);
    setSaving(false);
    onSuccess?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold">Accès clubs</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{item.name}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
        </div>

        {partnerUsers.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucun club partenaire créé.</p>
        ) : (
          <div className="space-y-2 mb-5">
            {partnerUsers.map(p => (
              <button key={p.id} type="button" onClick={() => toggle(String(p.id))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition ${
                  selected.includes(String(p.id))
                    ? "border-blue-400 bg-blue-50 text-blue-800"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}>
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-xs ${
                  selected.includes(String(p.id)) ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"
                }`}>
                  {selected.includes(String(p.id)) && "✓"}
                </span>
                <span className="font-medium">{p.club_name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 h-10 rounded-xl text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "#E10600" }}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal cadencement volants (admin) ─────────────────────────────────────────
function CadencementModal({ club, onClose, onReloadParent }) {
  const [subTab,        setSubTab]        = useState("commande");
  const [seasonOrder,   setSeasonOrder]   = useState(null);
  const [deliveries,    setDeliveries]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [lineForm,      setLineForm]      = useState(null);
  const [delivForm,     setDelivForm]     = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [editDelivId,   setEditDelivId]   = useState(null);
  const [editDelivForm, setEditDelivForm] = useState({});

  const today = new Date();
  const seasonStart = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  const season = `${seasonStart}-${seasonStart + 1}`;

  const reload = useCallback(async () => {
    setLoading(true);
    const [{ data: so }, { data: delivs }] = await Promise.all([
      supabase.from("partner_season_orders")
        .select("*, lines:partner_season_order_lines(*)")
        .eq("partner_user_id", club.id).eq("season", season).maybeSingle(),
      supabase.from("partner_deliveries")
        .select("*").eq("partner_user_id", club.id).order("date_livraison", { ascending: true }),
    ]);
    setSeasonOrder(so || null);
    setDeliveries(delivs || []);
    setLoading(false);
  }, [club.id, season]);

  useEffect(() => { reload(); }, [reload]);

  async function getOrCreateOrder() {
    if (seasonOrder) return seasonOrder;
    const { data } = await supabase.from("partner_season_orders")
      .insert({ store_id: STORE_ID, partner_user_id: club.id, season })
      .select("*, lines:partner_season_order_lines(*)")
      .single();
    return data;
  }

  async function saveLine() {
    if (!lineForm?.nom_produit?.trim() || !lineForm?.quantite_totale) return;
    setSaving(true);
    const so = await getOrCreateOrder();
    await supabase.from("partner_season_order_lines").insert({
      season_order_id: so.id,
      nom_produit:     lineForm.nom_produit.trim(),
      ref_produit:     lineForm.ref_produit?.trim() || null,
      prix_vente:      lineForm.prix_vente  ? Number(lineForm.prix_vente)  : null,
      quantite_totale: Number(lineForm.quantite_totale),
      pa_unit_ht:      lineForm.pa_unit_ht  ? Number(lineForm.pa_unit_ht)  : null,
    });
    setLineForm(null); setSaving(false); reload();
  }

  async function deleteLine(id) {
    await supabase.from("partner_season_order_lines").delete().eq("id", id);
    reload();
  }

  async function saveDelivery() {
    const nom = delivForm?.nom_produit;
    if (!nom || !delivForm?.date_livraison || !delivForm?.quantite) return;
    setSaving(true);
    await supabase.from("partner_deliveries").insert({
      store_id:             STORE_ID,
      partner_user_id:      club.id,
      season_order_line_id: delivForm.season_order_line_id || null,
      nom_produit:          nom,
      date_livraison:       delivForm.date_livraison,
      quantite:             Number(delivForm.quantite),
      num_facture:          delivForm.num_facture?.trim() || null,
      is_planned:           !delivForm.num_facture?.trim(),
    });
    setDelivForm(null); setSaving(false); reload();
  }

  async function deleteDelivery(id) {
    await supabase.from("partner_deliveries").delete().eq("id", id);
    reload();
  }

  async function saveEditDelivery() {
    if (!editDelivId) return;
    setSaving(true);
    await supabase.from("partner_deliveries").update({
      date_livraison: editDelivForm.date_livraison,
      quantite:       Number(editDelivForm.quantite),
      num_facture:    editDelivForm.num_facture?.trim() || null,
    }).eq("id", editDelivId);
    setEditDelivId(null);
    setEditDelivForm({});
    setSaving(false);
    reload();
  }

  async function changeDelivStatut(d, newStatut) {
    const isPlanned = newStatut === "en_attente";
    await supabase.from("partner_deliveries").update({ statut: newStatut, is_planned: isPlanned }).eq("id", d.id);
    if (newStatut !== "en_attente") {
      const labels = { en_cours: "En cours", expediee: "Expédiée" };
      await supabase.from("partner_notifications").insert({
        store_id:        STORE_ID,
        partner_user_id: club.id,
        message:         `Votre demande de ${d.quantite} × ${d.nom_produit} est maintenant : ${labels[newStatut] || newStatut}`,
        read:            false,
      });
    }
    reload();
    onReloadParent?.();
  }

  const lines      = seasonOrder?.lines || [];
  const totalVente = lines.reduce((s, l) => s + (Number(l.prix_vente) || 0) * (l.quantite_totale || 0), 0);
  const totalPA    = lines.reduce((s, l) => s + (Number(l.pa_unit_ht)  || 0) * (l.quantite_totale || 0), 0);
  const marge      = lines.reduce((s, l) => {
    const pvHT = (Number(l.prix_vente) || 0) / 1.20;
    return s + (pvHT - (Number(l.pa_unit_ht) || 0)) * (l.quantite_totale || 0);
  }, 0);

  const HATCH = "repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 10px)";
  const SUB   = (a) => `px-3 h-8 rounded-lg text-xs font-medium transition ${a ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold">Cadencement volants</h2>
            <p className="text-xs text-gray-400">{club.club_name} · Saison {season}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
            <button type="button" className={SUB(subTab === "commande")}   onClick={() => setSubTab("commande")}>📋 Commande saison</button>
            <button type="button" className={SUB(subTab === "livraisons")} onClick={() => setSubTab("livraisons")}>🚚 Livraisons</button>
          </div>

          {loading && <p className="text-sm text-gray-500">Chargement…</p>}

          {/* ── Commande saison ── */}
          {!loading && subTab === "commande" && (
            <div>
              {lines.length > 0 && (
                <div className="overflow-x-auto mb-4 rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-2 font-medium">Marque</th>
                        <th className="text-left px-3 py-2 font-medium">Réf</th>
                        <th className="text-right px-3 py-2 font-medium">Prix vente</th>
                        <th className="text-right px-3 py-2 font-medium">Qté</th>
                        <th className="text-right px-3 py-2 font-medium">Total</th>
                        <th className="text-right px-3 py-2 font-medium">PA unit.</th>
                        <th className="text-right px-3 py-2 font-medium">PA HT</th>
                        <th className="text-right px-3 py-2 font-medium">Marge</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map(l => {
                        const tv   = (Number(l.prix_vente) || 0) * (l.quantite_totale || 0);
                        const pvHT = (Number(l.prix_vente) || 0) / 1.20;
                        const pa   = (Number(l.pa_unit_ht)  || 0) * (l.quantite_totale || 0);
                        const mg   = (pvHT - (Number(l.pa_unit_ht) || 0)) * (l.quantite_totale || 0);
                        return (
                          <tr key={l.id} className="border-b border-gray-50">
                            <td className="px-3 py-2.5 font-medium">{l.nom_produit}</td>
                            <td className="px-3 py-2.5 text-gray-400 text-xs">{l.ref_produit || "—"}</td>
                            <td className="px-3 py-2.5 text-right">{l.prix_vente ? `${Number(l.prix_vente).toLocaleString("fr-FR")} €` : "—"}</td>
                            <td className="px-3 py-2.5 text-right">{l.quantite_totale}</td>
                            <td className="px-3 py-2.5 text-right">{tv ? `${tv.toLocaleString("fr-FR")} €` : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-gray-500">{l.pa_unit_ht ? `${Number(l.pa_unit_ht).toLocaleString("fr-FR")} €` : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-gray-500">{pa ? `${pa.toLocaleString("fr-FR")} €` : "—"}</td>
                            <td className={`px-3 py-2.5 text-right font-medium ${mg >= 0 ? "text-green-600" : "text-red-600"}`}>{mg ? `${mg.toLocaleString("fr-FR")} €` : "—"}</td>
                            <td className="px-3 py-2.5"><button type="button" onClick={() => deleteLine(l.id)} className="text-red-400 hover:text-red-600">✕</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200 text-xs font-bold">
                        <td colSpan={4} className="px-3 py-2 text-right text-gray-700">TOTAL</td>
                        <td className="px-3 py-2 text-right">{totalVente.toLocaleString("fr-FR")} €</td>
                        <td></td>
                        <td className="px-3 py-2 text-right text-gray-600">{totalPA.toLocaleString("fr-FR")} €</td>
                        <td className={`px-3 py-2 text-right ${marge >= 0 ? "text-green-600" : "text-red-600"}`}>{marge.toLocaleString("fr-FR")} €</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {lineForm ? (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-3">Nouveau produit</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="block text-xs text-gray-500 mb-1">Nom produit *</label>
                      <input value={lineForm.nom_produit || ""} onChange={e => setLineForm(p => ({...p, nom_produit: e.target.value}))} placeholder="ex. Linton 1" className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">Référence</label>
                      <input value={lineForm.ref_produit || ""} onChange={e => setLineForm(p => ({...p, ref_produit: e.target.value}))} placeholder="ex. AS-20" className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">Prix vente (€)</label>
                      <input type="number" step="0.01" value={lineForm.prix_vente || ""} onChange={e => setLineForm(p => ({...p, prix_vente: e.target.value}))} placeholder="ex. 24.00" className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">Quantité totale saison *</label>
                      <input type="number" value={lineForm.quantite_totale || ""} onChange={e => setLineForm(p => ({...p, quantite_totale: e.target.value}))} placeholder="ex. 300" className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">PA unit. HT (€)</label>
                      <input type="number" step="0.01" value={lineForm.pa_unit_ht || ""} onChange={e => setLineForm(p => ({...p, pa_unit_ht: e.target.value}))} placeholder="ex. 16.50" className={inputCls} /></div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setLineForm(null)} className="h-9 px-4 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-100">Annuler</button>
                    <button type="button" onClick={saveLine} disabled={saving} className="h-9 px-4 rounded-xl text-xs font-bold text-white disabled:opacity-50" style={{ background: "#E10600" }}>
                      {saving ? "Enregistrement…" : "Ajouter"}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setLineForm({})}
                  className="w-full h-9 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 hover:bg-gray-50 transition">
                  + Ajouter un produit
                </button>
              )}
            </div>
          )}

          {/* ── Livraisons ── */}
          {!loading && subTab === "livraisons" && (
            <div>
              {deliveries.length > 0 && (
                <div className="overflow-x-auto mb-4 rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-2 font-medium">Date</th>
                        <th className="text-left px-3 py-2 font-medium">Marque</th>
                        <th className="text-right px-3 py-2 font-medium">Qté</th>
                        <th className="text-left px-3 py-2 font-medium">N° Facture</th>
                        <th className="text-left px-3 py-2 font-medium">Statut</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map(d => {
                        const statut = d.statut || (d.is_planned ? "en_attente" : "expediee");
                        const STATUT_CFG = {
                          en_attente: { label: "En attente", cls: "bg-yellow-100 text-yellow-700" },
                          en_cours:   { label: "En cours",   cls: "bg-blue-100 text-blue-700"   },
                          expediee:   { label: "Expédiée",   cls: "bg-green-100 text-green-700" },
                        };
                        const cfg = STATUT_CFG[statut] || STATUT_CFG.en_attente;
                        const isEditing = editDelivId === d.id;
                        if (isEditing) {
                          return (
                            <tr key={d.id} className="border-b border-blue-100 bg-blue-50">
                              <td className="px-2 py-1.5"><input type="date" value={editDelivForm.date_livraison || ""} onChange={e => setEditDelivForm(p => ({...p, date_livraison: e.target.value}))} className="w-full h-7 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none" /></td>
                              <td className="px-2 py-1.5 text-xs text-gray-500">
                                {d.nom_produit}
                                {lines.find(l => l.id === d.season_order_line_id)?.ref_produit && <span className="ml-1 text-gray-400">— {lines.find(l => l.id === d.season_order_line_id).ref_produit}</span>}
                              </td>
                              <td className="px-2 py-1.5"><input type="number" value={editDelivForm.quantite || ""} onChange={e => setEditDelivForm(p => ({...p, quantite: e.target.value}))} className="w-16 h-7 px-2 rounded-lg border border-gray-200 text-xs text-right focus:outline-none" /></td>
                              <td className="px-2 py-1.5"><input value={editDelivForm.num_facture || ""} onChange={e => setEditDelivForm(p => ({...p, num_facture: e.target.value}))} placeholder="N° facture" className="w-full h-7 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none" /></td>
                              <td className="px-2 py-1.5">
                                <select value={statut} onChange={e => changeDelivStatut(d, e.target.value)} className={`h-6 pl-2 pr-6 rounded-full text-[10px] font-medium border-0 cursor-pointer focus:outline-none ${cfg.cls}`}>
                                  <option value="en_attente">En attente</option>
                                  <option value="en_cours">En cours</option>
                                  <option value="expediee">Expédiée</option>
                                </select>
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="flex gap-1">
                                  <button type="button" onClick={saveEditDelivery} disabled={saving} className="h-6 px-2 rounded-lg bg-green-100 text-green-700 text-xs hover:bg-green-200">✓</button>
                                  <button type="button" onClick={() => setEditDelivId(null)} className="h-6 px-2 rounded-lg bg-gray-100 text-gray-500 text-xs hover:bg-gray-200">✕</button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={d.id} style={statut === "en_attente" ? { backgroundImage: HATCH } : {}} className="border-b border-gray-50">
                            <td className="px-3 py-2 text-xs">{new Date(d.date_livraison).toLocaleDateString("fr-FR")}</td>
                            <td className="px-3 py-2">
                              {d.nom_produit}
                              {lines.find(l => l.id === d.season_order_line_id)?.ref_produit && (
                                <span className="ml-1.5 text-xs text-gray-400">— {lines.find(l => l.id === d.season_order_line_id).ref_produit}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">{d.quantite}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{d.num_facture || "—"}</td>
                            <td className="px-3 py-2">
                              <select value={statut} onChange={e => changeDelivStatut(d, e.target.value)} className={`h-6 pl-2 pr-6 rounded-full text-[10px] font-medium border-0 cursor-pointer focus:outline-none ${cfg.cls}`}>
                                <option value="en_attente">En attente</option>
                                <option value="en_cours">En cours</option>
                                <option value="expediee">Expédiée</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <button type="button" onClick={() => { setEditDelivId(d.id); setEditDelivForm({ date_livraison: d.date_livraison, quantite: d.quantite, num_facture: d.num_facture || "" }); }} className="text-blue-400 hover:text-blue-600 text-xs">✏️</button>
                                <button type="button" onClick={() => deleteDelivery(d.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Reste à livrer */}
              {lines.length > 0 && (
                <div className="overflow-x-auto mb-4 rounded-xl border border-gray-200">
                  <div className="bg-gray-800 text-white text-xs font-bold px-4 py-2 tracking-wide uppercase">Reste à livrer</div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-2 font-medium">Marque</th>
                        <th className="text-left px-3 py-2 font-medium">Réf</th>
                        <th className="text-right px-3 py-2 font-medium">Qté commandée</th>
                        <th className="text-right px-3 py-2 font-medium">Qté livrée</th>
                        <th className="text-right px-3 py-2 font-medium">Reste</th>
                        <th className="text-right px-3 py-2 font-medium">Dispo en mag.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map(line => {
                        const livree   = deliveries.filter(d => d.season_order_line_id === line.id && !d.is_planned).reduce((s, d) => s + (d.quantite || 0), 0);
                        const reste    = (line.quantite_totale || 0) - livree;
                        const dispo    = line.stock_dispo || 0;
                        const manquant = reste - dispo;
                        return (
                          <tr key={line.id} className="border-b border-gray-50">
                            <td className="px-3 py-2 text-xs">{line.nom_produit}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{line.ref_produit || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{line.quantite_totale || 0}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{livree}</td>
                            <td className={`px-3 py-2 text-right tabular-nums font-bold ${reste < 0 ? "text-red-600" : reste === 0 ? "text-green-600" : "text-gray-900"}`}>{reste}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {dispo > 0 && (
                                  <span className="tabular-nums font-bold text-xs">
                                    {manquant > 0 ? <><span style={{color:"#f97316"}}>{dispo}</span><span style={{color:"#dc2626"}}>/{manquant}</span></> : <span style={{color:"#16a34a"}}>{dispo}</span>}
                                  </span>
                                )}
                                <input
                                  type="number"
                                  min="0"
                                  defaultValue={dispo || ""}
                                  placeholder="0"
                                  className="w-16 h-7 rounded-lg border border-gray-200 text-xs text-right px-2 focus:outline-none focus:border-gray-400"
                                  onBlur={async e => {
                                    const val = parseInt(e.target.value) || 0;
                                    await supabase.from("partner_season_order_lines").update({ stock_dispo: val }).eq("id", line.id);
                                    reload();
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {delivForm ? (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-3">Nouvelle livraison</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="block text-xs text-gray-500 mb-1">Produit *</label>
                      {lines.length > 0 ? (
                        <select value={delivForm.season_order_line_id || ""} onChange={e => {
                          const l = lines.find(x => x.id === e.target.value);
                          setDelivForm(p => ({...p, season_order_line_id: e.target.value, nom_produit: l?.nom_produit || ""}));
                        }} className={inputCls}>
                          <option value="">— Choisir —</option>
                          {lines.map(l => <option key={l.id} value={l.id}>{l.nom_produit}{l.ref_produit ? ` — ${l.ref_produit}` : ""}</option>)}
                        </select>
                      ) : (
                        <input value={delivForm.nom_produit || ""} onChange={e => setDelivForm(p => ({...p, nom_produit: e.target.value}))} placeholder="Nom du produit" className={inputCls} />
                      )}
                    </div>
                    <div><label className="block text-xs text-gray-500 mb-1">Date *</label>
                      <input type="date" value={delivForm.date_livraison || ""} onChange={e => setDelivForm(p => ({...p, date_livraison: e.target.value}))} className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">Quantité *</label>
                      <input type="number" value={delivForm.quantite || ""} onChange={e => setDelivForm(p => ({...p, quantite: e.target.value}))} placeholder="ex. 50" className={inputCls} /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">N° Facture <span className="text-gray-400">(vide = planifié)</span></label>
                      <input value={delivForm.num_facture || ""} onChange={e => setDelivForm(p => ({...p, num_facture: e.target.value}))} placeholder="ex. FD0184" className={inputCls} /></div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDelivForm(null)} className="h-9 px-4 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-100">Annuler</button>
                    <button type="button" onClick={saveDelivery} disabled={saving} className="h-9 px-4 rounded-xl text-xs font-bold text-white disabled:opacity-50" style={{ background: "#E10600" }}>
                      {saving ? "Enregistrement…" : "Ajouter"}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setDelivForm({})}
                  className="w-full h-9 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 hover:bg-gray-50 transition">
                  + Ajouter une livraison
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Onglet Catalogue ──────────────────────────────────────────────────────────
function TabCatalogue({ partnerUsers }) {
  const [subTab,      setSubTab]      = useState("textile");
  const [catalog,     setCatalog]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null);
  const [accessModal, setAccessModal] = useState(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("partner_catalog").select("*").eq("store_id", STORE_ID).order("created_at", { ascending: false });
    setCatalog(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  async function toggleActive(item) {
    await supabase.from("partner_catalog").update({ active: !item.active }).eq("id", item.id);
    loadCatalog();
  }

  async function deleteItem(id) {
    if (!window.confirm("Supprimer cet article ?")) return;
    await supabase.from("partner_catalog").delete().eq("id", id);
    loadCatalog();
  }

  const filtered = catalog.filter(c => c.type === subTab);

  const SUB_CLS = (active) => [
    "px-3 h-8 rounded-lg text-xs font-medium transition",
    active ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
  ].join(" ");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-200/60 rounded-xl p-1 w-fit">
          <button type="button" className={SUB_CLS(subTab === "textile")} onClick={() => setSubTab("textile")}>👕 Textile</button>
          <button type="button" className={SUB_CLS(subTab === "volants")} onClick={() => setSubTab("volants")}>🏸 Volants</button>
        </div>
        <button type="button" onClick={() => setModal({ type: subTab })}
          className="h-8 px-3 rounded-lg text-xs font-bold text-white"
          style={{ background: "#E10600" }}>
          + Ajouter
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400">Chargement…</p>}

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <div className="text-3xl mb-2">{subTab === "textile" ? "👕" : "🏸"}</div>
          <p className="font-medium text-gray-600">Aucun article</p>
          <p className="text-sm text-gray-400 mt-1">Ajoutez des articles pour que les clubs puissent commander.</p>
          <button type="button" onClick={() => setModal({ type: subTab })}
            className="mt-4 h-8 px-4 rounded-lg text-xs font-bold text-white"
            style={{ background: "#E10600" }}>
            + Ajouter
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(item => {
          const d = item.details || {};
          const subtitle = item.type === "textile"
            ? [d.tailles?.join(", "), d.couleurs?.join(", ")].filter(Boolean).join(" · ")
            : [d.marque, d.modele, d.vitesses?.length ? `Vitesses : ${d.vitesses.join(", ")}` : null].filter(Boolean).join(" · ");

          return (
            <div key={item.id} className={`rounded-lg border px-4 py-3 flex items-center gap-4 transition-colors duration-150 ${
              item.active ? "bg-gray-100 border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm" : "bg-gray-50 border-gray-100 opacity-60"
            }`}>
              {item.image_url
                ? <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-200" />
                : <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-xl shrink-0">{item.type === "textile" ? "👕" : "🏸"}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900">{item.name}</span>
                  {d.prix && <span className="text-xs text-gray-400">{Number(d.prix).toLocaleString("fr-FR")} €</span>}
                  {!item.active && <span className="text-[10px] text-gray-400 italic">Désactivé</span>}
                </div>
                {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
                <div className="flex flex-wrap gap-1 mt-1">
                  {(item.partner_user_ids || []).length === 0
                    ? <span className="text-[10px] text-gray-300 italic">Aucun club assigné</span>
                    : (item.partner_user_ids || []).map(uid => {
                        const club = partnerUsers.find(p => String(p.id) === String(uid));
                        return club ? (
                          <span key={uid} className="inline-flex items-center px-1.5 h-4 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                            {club.club_name}
                          </span>
                        ) : null;
                      })
                  }
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => setAccessModal(item)}
                  className="h-7 px-2.5 rounded-lg border border-amber-200 text-amber-700 text-xs hover:bg-amber-50 transition">
                  Accès
                </button>
                <button type="button" onClick={() => setModal({ type: item.type, item })}
                  className="h-7 px-2.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-100 transition">
                  Modifier
                </button>
                <button type="button" onClick={() => toggleActive(item)}
                  className={`h-7 px-2.5 rounded-lg border text-xs transition ${
                    item.active ? "border-gray-200 text-gray-500 hover:bg-gray-100" : "border-green-200 text-green-600 hover:bg-green-50"
                  }`}>
                  {item.active ? "Désactiver" : "Activer"}
                </button>
                <button type="button" onClick={() => deleteItem(item.id)}
                  className="h-7 px-2.5 rounded-lg border border-red-100 text-red-500 text-xs hover:bg-red-50 transition">
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <CatalogItemModal
          type={modal.type}
          item={modal.item}
          onClose={() => setModal(null)}
          onSuccess={loadCatalog}
        />
      )}
      {accessModal && (
        <ClubAccessModal
          item={accessModal}
          partnerUsers={partnerUsers}
          onClose={() => setAccessModal(null)}
          onSuccess={loadCatalog}
        />
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function PartenariatPage() {
  const [tab,           setTab]           = useState("clubs");
  const [partnerUsers,  setPartnerUsers]  = useState([]);
  const [orders,        setOrders]        = useState([]);
  const [catalog,       setCatalog]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showAdd,          setShowAdd]          = useState(false);
  const [selectedOrder,    setSelectedOrder]    = useState(null);
  const [cadencementClub,  setCadencementClub]  = useState(null);
  const [confirmDelete,    setConfirmDelete]    = useState(null);
  const [filterClub,       setFilterClub]       = useState("");
  const [filterArticle,    setFilterArticle]    = useState("");
  const [filterTaille,     setFilterTaille]     = useState("");
  const [filterCouleur,    setFilterCouleur]    = useState("");
  const [pendingDelivsMap, setPendingDelivsMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: users }, { data: ords }, { data: cat }, { data: pendDelivs }] = await Promise.all([
      supabase.from("partner_users").select("*").eq("store_id", STORE_ID).order("created_at", { ascending: false }),
      supabase.from("partner_orders").select("*").eq("store_id", STORE_ID).order("created_at", { ascending: false }),
      supabase.from("partner_catalog").select("id, name, type, image_url, details").eq("store_id", STORE_ID),
      supabase.from("partner_deliveries").select("partner_user_id").eq("store_id", STORE_ID).eq("statut", "en_attente"),
    ]);
    setPartnerUsers(users || []);
    setOrders(ords || []);
    setCatalog(cat || []);
    const map = {};
    (pendDelivs || []).forEach(d => { map[d.partner_user_id] = (map[d.partner_user_id] || 0) + 1; });
    setPendingDelivsMap(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== "commandes") return;
    supabase.from("partner_notifications").update({ read: true }).eq("store_id", STORE_ID).eq("read", false);
  }, [tab]);

  const unreadCount = orders.filter(o => o.status === "en_attente").length;

  async function deletePartner(id) {
    if (!window.confirm("Supprimer ce club partenaire ?")) return;
    await supabase.from("partner_users").delete().eq("id", id);
    load();
  }

  const TAB_CLS = (active) => [
    "px-4 h-9 rounded-lg text-sm font-medium transition",
    active ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
  ].join(" ");

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: "rgba(225,6,0,0.1)", border: "1px solid rgba(225,6,0,0.25)" }}>
            🤝
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Partenariat</h1>
            <p className="text-sm text-gray-500">Gérez vos clubs partenaires et leurs commandes</p>
          </div>
        </div>
        {tab === "clubs" && (
          <button type="button" onClick={() => setShowAdd(true)}
            className="h-8 px-3 rounded-lg text-xs font-bold text-white flex items-center gap-2"
            style={{ background: "#E10600" }}>
            + Ajouter un club
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-200/60 rounded-xl p-1 w-fit mb-5">
        <button type="button" className={TAB_CLS(tab === "clubs")} onClick={() => setTab("clubs")}>
          Clubs ({partnerUsers.length})
        </button>
        <button type="button" className={TAB_CLS(tab === "commandes")} onClick={() => setTab("commandes")}>
          Commandes
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1.5 h-4" style={{ background: "#f59e0b" }}>
              {unreadCount}
            </span>
          )}
        </button>
        <button type="button" className={TAB_CLS(tab === "catalogue")} onClick={() => setTab("catalogue")}>
          Catalogue
        </button>
      </div>

      {loading && tab !== "catalogue" && <div className="text-sm text-gray-500">Chargement…</div>}

      {/* ── Tab clubs ── */}
      {!loading && tab === "clubs" && (
        <div className="space-y-2">
          {partnerUsers.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="text-4xl mb-3">🤝</div>
              <p className="font-semibold text-gray-700">Aucun club partenaire</p>
              <p className="text-sm text-gray-400 mt-1">Ajoutez votre premier club pour qu'il puisse passer des commandes.</p>
              <button type="button" onClick={() => setShowAdd(true)}
                className="mt-4 h-10 px-5 rounded-xl text-sm font-bold text-white"
                style={{ background: "#E10600" }}>
                + Ajouter un club
              </button>
            </div>
          )}
          {partnerUsers.map(p => {
            const clubOrders = orders.filter(o => o.partner_user_id === p.id);
            const pending    = clubOrders.filter(o => o.status === "en_attente").length;
            return (
              <div key={p.id} className="bg-gray-100 rounded-lg border border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm transition-colors duration-150 px-4 py-3 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-lg shrink-0">🏅</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{p.club_name}</span>
                    {pending > 0 && (
                      <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-bold text-white" style={{ background: "#f59e0b" }}>
                        {pending} en attente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{p.email} · Depuis le {fmtDate(p.created_at)}</p>
                  <p className="text-xs text-gray-400">{clubOrders.length} commande{clubOrders.length !== 1 ? "s" : ""} au total</p>
                </div>
                <button type="button"
                  onClick={() => window.open(`/portal?preview=${p.id}`, "_blank")}
                  className="shrink-0 h-8 px-3 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition">
                  👁 Aperçu
                </button>
                <button type="button" onClick={() => setCadencementClub(p)} className="relative shrink-0 h-8 px-3 rounded-lg border border-blue-100 text-blue-600 text-xs hover:bg-blue-50 transition">
                  🏸 Cadencement
                  {(pendingDelivsMap[p.id] || 0) > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingDelivsMap[p.id]}
                    </span>
                  )}
                </button>
                <button type="button" onClick={() => deletePartner(p.id)}
                  className="shrink-0 h-8 px-3 rounded-lg border border-red-100 text-red-500 text-xs hover:bg-red-50 transition">
                  Supprimer
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab commandes ── */}
      {!loading && tab === "commandes" && (() => {
        const allArticles = [...new Set(orders.map(o => o.details?.article).filter(Boolean))].sort();
        const allTailles  = [...new Set(orders.map(o => o.details?.taille).filter(Boolean))].sort();
        const allCouleurs = [...new Set(orders.map(o => o.details?.couleur).filter(Boolean))].sort();

        const filtered = orders.filter(o => {
          if (filterClub    && o.partner_user_id !== filterClub) return false;
          if (filterArticle && o.details?.article !== filterArticle) return false;
          if (filterTaille  && o.details?.taille  !== filterTaille)  return false;
          if (filterCouleur && o.details?.couleur !== filterCouleur) return false;
          return true;
        });

        const hasFilters = filterClub || filterArticle || filterTaille || filterCouleur;
        const selCls = "h-9 pl-3 pr-8 rounded-xl border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:border-gray-400 cursor-pointer";

        return (
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              <select value={filterClub} onChange={e => setFilterClub(e.target.value)} className={selCls}>
                <option value="">Tous les clubs</option>
                {partnerUsers.map(p => <option key={p.id} value={p.id}>{p.club_name}</option>)}
              </select>
              <select value={filterArticle} onChange={e => setFilterArticle(e.target.value)} className={selCls}>
                <option value="">Tous les articles</option>
                {allArticles.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filterTaille} onChange={e => setFilterTaille(e.target.value)} className={selCls}>
                <option value="">Toutes les tailles</option>
                {allTailles.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterCouleur} onChange={e => setFilterCouleur(e.target.value)} className={selCls}>
                <option value="">Toutes les couleurs</option>
                {allCouleurs.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {hasFilters && (
                <button type="button" onClick={() => { setFilterClub(""); setFilterArticle(""); setFilterTaille(""); setFilterCouleur(""); }}
                  className="h-9 px-3 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition">
                  Réinitialiser
                </button>
              )}
            </div>

            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-4xl mb-3">📦</div>
                <p className="font-semibold text-gray-700">Aucune commande</p>
                <p className="text-sm text-gray-400 mt-1">Les commandes des clubs apparaîtront ici.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <p className="text-sm text-gray-500">Aucune commande ne correspond aux filtres.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(order => {
                  const club    = partnerUsers.find(p => p.id === order.partner_user_id);
                  const typeCfg = TYPE_CONFIG[order.type] || { label: order.type, icon: "📦" };
                  const d = order.details || {};
                  const tags = [d.taille, d.couleur, d.vitesse ? `v.${d.vitesse}` : null, d.quantite ? `×${d.quantite}` : null].filter(Boolean);
                  return (
                    <div key={order.id}
                      className="bg-gray-100 rounded-lg border border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm transition-colors duration-150 px-4 py-3 flex items-center gap-4 cursor-pointer"
                      onClick={() => setSelectedOrder(order)}>
                      <span className="text-xl shrink-0">{typeCfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">{club?.club_name || "Club inconnu"}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-600 font-medium">{d.article || typeCfg.label}</span>
                          {tags.map((t, i) => (
                            <span key={i} className="inline-flex items-center px-1.5 h-4 rounded bg-gray-200 text-[10px] text-gray-600">{t}</span>
                          ))}
                        </div>
                        {order.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{order.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusBadge status={order.status} />
                        <span className="text-xs text-gray-400">{fmtDate(order.created_at)}</span>
                        <button type="button"
                          onClick={e => { e.stopPropagation(); setConfirmDelete(order); }}
                          className="h-8 px-3 rounded-lg border border-red-100 text-red-500 text-xs hover:bg-red-50 transition shrink-0">
                          Supprimer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Tab catalogue ── */}
      {tab === "catalogue" && <TabCatalogue partnerUsers={partnerUsers} />}

      {cadencementClub && <CadencementModal club={cadencementClub} onClose={() => setCadencementClub(null)} onReloadParent={load} />}
      {showAdd && <AddClubModal onClose={() => setShowAdd(false)} onSuccess={load} />}
      {confirmDelete && (
        <ConfirmModal
          title="Supprimer la commande"
          message={`Voulez-vous vraiment supprimer la commande de ${partnerUsers.find(p => p.id === confirmDelete.partner_user_id)?.club_name || "ce club"} ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          onConfirm={async () => { await supabase.from("partner_orders").delete().eq("id", confirmDelete.id); load(); }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          partnerUsers={partnerUsers}
          catalog={catalog}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={load}
        />
      )}
    </div>
  );
}
