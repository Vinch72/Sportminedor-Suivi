-- ════════════════════════════════════════════════════════════════════════════
-- ANNULATION du rattrapage 20261010090000_backfill_raquettes.sql
-- Supprime les raquettes créées par le rattrapage (journal) et retire leur
-- lien dans suivi / tournoi_raquettes. Les textes "raquette" ne bougent pas.
-- ⚠️ Une raquette créée par le rattrapage puis réutilisée par l'équipe est
-- aussi supprimée (les lignes concernées perdent juste le lien).
-- À exécuter UNIQUEMENT si besoin de revenir en arrière.
-- ════════════════════════════════════════════════════════════════════════════

begin;

update public.suivi             set raquette_id = null where raquette_id in (select raquette_id from public.raquettes_backfill_log);
update public.tournoi_raquettes set raquette_id = null where raquette_id in (select raquette_id from public.raquettes_backfill_log);
delete from public.raquettes where id in (select raquette_id from public.raquettes_backfill_log);
delete from public.raquettes_backfill_log;

commit;

select count(*) as raquettes_restantes from public.raquettes;
