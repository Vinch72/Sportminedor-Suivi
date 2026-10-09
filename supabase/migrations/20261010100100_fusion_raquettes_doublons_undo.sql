-- ════════════════════════════════════════════════════════════════════════════
-- ANNULATION de 20261010100000_fusion_raquettes_doublons.sql
-- Recrée les raquettes supprimées (mêmes id), remet les lignes suivi /
-- tournoi_raquettes sur leur raquette d'origine, et restaure les raquettes
-- gardées dans leur état d'avant fusion. À exécuter UNIQUEMENT si besoin.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- 1. Raquettes supprimées
insert into public.raquettes
select (jsonb_populate_record(null::public.raquettes, l.row)).*
from public.raquettes_merge_log l
where exists (select 1 from public.clients c where c.id = l.row->>'client_id')
on conflict (id) do nothing;

-- 2. Liens d'origine (seulement si la ligne pointe encore sur la raquette gardée)
update public.suivi s set raquette_id = l.old_raquette_id
  from public.raquettes_merge_links l
 where l.tbl = 'suivi' and s.id::text = l.row_id and s.raquette_id = l.new_raquette_id
   and exists (select 1 from public.raquettes r where r.id = l.old_raquette_id);

update public.tournoi_raquettes t set raquette_id = l.old_raquette_id
  from public.raquettes_merge_links l
 where l.tbl = 'tournoi_raquettes' and t.id::text = l.row_id and t.raquette_id = l.new_raquette_id
   and exists (select 1 from public.raquettes r where r.id = l.old_raquette_id);

-- 3. Raquettes gardées : infos d'avant fusion
update public.raquettes r set
  pref_cordage_id = case when exists (select 1 from public.cordages c where c.cordage = k.row->>'pref_cordage_id')
                         then k.row->>'pref_cordage_id' end,
  pref_tension    = k.row->>'pref_tension',
  notes           = k.row->>'notes'
  from public.raquettes_merge_kept k
 where r.id = k.id;

delete from public.raquettes_merge_links;
delete from public.raquettes_merge_kept;
delete from public.raquettes_merge_log;

commit;

select count(*) as raquettes_total from public.raquettes;
