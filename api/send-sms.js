// Valeurs publiques (déjà présentes dans le bundle front) — fallback si les
// variables d'env ne sont pas exposées à la fonction serverless.
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://xwzbeglciommkzwjafan.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3emJlZ2xjaW9tbWt6d2phZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5Nzc3MzQsImV4cCI6MjA3MjU1MzczNH0.7sPB9uaA5By_vRKa-vRfdQWn-M632iC-OlPYc1LCyIc";

// Vérifie le JWT Supabase de l'appelant via la RPC is_staff()
// (401 si jeton invalide/expiré, false si club partenaire).
async function isStaff(authorization) {
  if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_staff`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ✅ Appelant : session Supabase valide d'un membre du staff (pas un club partenaire)
    if (!(await isStaff(req.headers.authorization))) {
      return res.status(401).json({ error: "Non autorisé" });
    }

    const { to, content } = req.body || {};

    // ✅ from fixé côté serveur
    const from = process.env.HTTPSMS_FROM;

    if (!to || !content) {
      return res.status(400).json({ error: "Missing to/content" });
    }
    if (!from) {
      return res.status(500).json({ error: "Missing HTTPSMS_FROM env var" });
    }

    const apiKey = process.env.HTTPSMS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing HTTPSMS_API_KEY env var" });
    }

    const r = await fetch("https://api.httpsms.com/v1/messages/send", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, from, content }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(502).json({ error: "httpSMS error", details: data });
    }

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
