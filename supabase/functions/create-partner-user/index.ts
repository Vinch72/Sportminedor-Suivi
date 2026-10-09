// supabase/functions/create-partner-user/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STORE_ID = "sportminedor";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Client admin (service role key — jamais exposé côté front)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 0. Vérifier l'appelant : connecté ET membre du staff du magasin
    //    (ni club partenaire, ni compte "tournament_only")
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Non authentifié" }, 401);

    const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
    const caller = callerData?.user;
    if (callerErr || !caller) return json({ error: "Non authentifié" }, 401);

    const [{ data: callerPartner }, { data: callerProfile }] = await Promise.all([
      admin.from("partner_users").select("id").eq("user_id", caller.id).maybeSingle(),
      admin.from("profiles").select("role").eq("id", caller.id).maybeSingle(),
    ]);
    const callerRole = callerProfile?.role ?? "user";
    if (
      callerPartner ||
      caller.user_metadata?.role === "partner" ||
      callerRole === "partner" ||
      callerRole === "tournament_only"
    ) {
      return json({ error: "Accès refusé" }, 403);
    }

    const { email, password, club_name, store_id, club_id } = await req.json();

    if (store_id && store_id !== STORE_ID) {
      return json({ error: "Magasin invalide" }, 403);
    }

    if (!email || !password || !club_name) {
      return json({ error: "Champs manquants : email, password, club_name" }, 400);
    }

    // 1. Créer le compte Supabase Auth
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role:      "partner",
        club_name,
        store_id:  STORE_ID,
      },
    });

    if (authErr) return json({ error: authErr.message }, 400);

    // 2. Insérer dans partner_users
    const { error: dbErr } = await admin.from("partner_users").insert({
      store_id: STORE_ID,
      user_id:  authData.user.id,
      club_name,
      email,
      club_id:  club_id || null,
    });

    if (dbErr) {
      // Rollback : supprimer le user Auth créé
      await admin.auth.admin.deleteUser(authData.user.id);
      return json({ error: dbErr.message }, 400);
    }

    return json({ success: true, user_id: authData.user.id }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
