export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
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
