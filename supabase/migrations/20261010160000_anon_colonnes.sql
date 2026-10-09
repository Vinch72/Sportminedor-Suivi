-- ════════════════════════════════════════════════════════════════════════════
-- Public (anon) : seulement les colonnes utiles aux pages QR
-- Avant : anon lisait toutes les colonnes de clubs (notes internes, compteurs
-- de bobines facturées) et de cordages (gains tournoi / magasin = marges).
-- Après : droits par colonne pour anon. Le staff (authenticated) ne change pas.
-- SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

-- ── clubs : nom, bobines (prix), logo, casier, message ──────────────────────
revoke select on public.clubs from anon;
grant select (clubs, bobine_base, bobine_specific, logo_url, depot_token,
              notification_message, notification_start, notification_end)
  on public.clubs to anon;

-- ── cordages : nom, marque, basique/spécifique, infos « i » ────────────────
revoke select on public.cordages from anon;
grant select (cordage, marque, is_base,
              info_controle, info_puissance, info_durabilite, info_note)
  on public.cordages to anon;
