-- ════════════════════════════════════════════════════════════════════════════
-- Infos cordage (comme Stringflow) : jauges 0-5 + note courte, affichées aux
-- joueurs via le bouton « i » de la page QR. Colonnes facultatives (additif).
-- SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.cordages
  add column if not exists info_controle   smallint check (info_controle   between 0 and 5),
  add column if not exists info_puissance  smallint check (info_puissance  between 0 and 5),
  add column if not exists info_durabilite smallint check (info_durabilite between 0 and 5),
  add column if not exists info_note       text;
