// supabase/functions/create-partner-user/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password, club_name, store_id, club_id } = await req.json();

    if (!email || !password || !club_name || !store_id) {
      return new Response(
        JSON.stringify({ error: "Champs manquants : email, password, club_name, store_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client admin (service role key — jamais exposé côté front)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Créer le compte Supabase Auth
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role:      "partner",
        club_name,
        store_id,
      },
    });

    if (authErr) {
      return new Response(
        JSON.stringify({ error: authErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Insérer dans partner_users
    const { error: dbErr } = await admin.from("partner_users").insert({
      store_id,
      user_id:  authData.user.id,
      club_name,
      email,
      club_id:  club_id || null,
    });

    if (dbErr) {
      // Rollback : supprimer le user Auth créé
      await admin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: dbErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: authData.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
