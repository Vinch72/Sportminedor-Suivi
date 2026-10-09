-- ════════════════════════════════════════════════════════════════════════════
-- Rattrapage : crée les raquettes à partir des textes déjà saisis
-- (suivi.raquette et tournoi_raquettes.raquette) et lie les lignes existantes.
-- • 1 raquette par client et par modèle (texte normalisé : majuscules,
--   espaces simplifiés) ; réutilise une raquette déjà enregistrée identique
-- • cordage + tension préférés = ceux de la dernière utilisation
-- • textes vides / sans sens ignorés ; lignes déjà liées non touchées
-- • ANNULABLE : chaque raquette créée est notée dans raquettes_backfill_log
--   → 20261010090100_backfill_raquettes_undo.sql pour tout défaire
-- Nécessite 20261009170000. SQL Editor. Relançable sans doublon.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.raquettes_backfill_log (
  raquette_id uuid primary key,
  created_at  timestamptz not null default now()
);
alter table public.raquettes_backfill_log enable row level security; -- aucune policy : invisible pour l'app

-- Texte normalisé d'une raquette
create or replace function pg_temp.norm_rq(t text) returns text
language sql immutable as $$
  select upper(trim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')));
$$;

-- Toutes les utilisations (suivi + tournois) avec texte exploitable
create temp table rq_src on commit drop as
select s.client_id, pg_temp.norm_rq(s.raquette) as txt, s.cordage_id::text as cordage, s.tension::text as tension,
       case when s.date::text ~ '^\d{4}-\d{2}-\d{2}' then left(s.date::text, 10)::date end as d
from public.suivi s
where s.client_id is not null and s.raquette_id is null
union all
select t.client_id, pg_temp.norm_rq(t.raquette), t.cordage_id::text, t.tension::text,
       case when t.date::text ~ '^\d{4}-\d{2}-\d{2}' then left(t.date::text, 10)::date end
from public.tournoi_raquettes t
where t.client_id is not null and t.raquette_id is null;

delete from rq_src
where txt !~ '[A-Z0-9].*[A-Z0-9]'                                   -- au moins 2 caractères utiles
   or txt in ('RAQUETTE', 'RAQ', 'NC', 'N/C', 'N/A', 'NA', 'INCONNU', 'INCONNUE',
              'AUCUNE', 'AUCUN', 'XX', 'XXX', 'TEST');

-- Une ligne par (client, modèle) : dernière utilisation (cordage/tension)
create temp table rq_new on commit drop as
select distinct on (client_id, txt) client_id, txt, cordage, tension, d
from rq_src
order by client_id, txt, d desc nulls last;

-- Ne pas recréer ce qui existe déjà chez le client
delete from rq_new n
using public.raquettes r
where r.client_id = n.client_id
  and (pg_temp.norm_rq(r.model) = n.txt or pg_temp.norm_rq(concat_ws(' ', r.brand, r.model)) = n.txt);

-- Création + journal
with ins as (
  insert into public.raquettes (client_id, model, pref_cordage_id, pref_tension, created_at)
  select n.client_id, left(n.txt, 200),
         (select c.cordage from public.cordages c where c.cordage = n.cordage),
         nullif(n.tension, ''),
         coalesce(n.d::timestamptz, now())
  from rq_new n
  returning id
)
insert into public.raquettes_backfill_log (raquette_id) select id from ins;

-- Liaison des lignes existantes (raquette la plus récente si doublon)
create temp table rq_map on commit drop as
select distinct on (r.client_id, k.txt) r.client_id, k.txt, r.id
from public.raquettes r
cross join lateral (values (pg_temp.norm_rq(r.model)), (pg_temp.norm_rq(concat_ws(' ', r.brand, r.model)))) k(txt)
order by r.client_id, k.txt, r.created_at desc;

update public.suivi s
   set raquette_id = m.id
  from rq_map m
 where s.raquette_id is null and s.client_id = m.client_id and pg_temp.norm_rq(s.raquette) = m.txt;

update public.tournoi_raquettes t
   set raquette_id = m.id
  from rq_map m
 where t.raquette_id is null and t.client_id = m.client_id and pg_temp.norm_rq(t.raquette) = m.txt;

commit;

-- ── Bilan ──────────────────────────────────────────────────────────────────
select
  (select count(*) from public.raquettes_backfill_log)                                        as raquettes_creees,
  (select count(*) from public.raquettes)                                                      as raquettes_total,
  (select count(*) from public.suivi where raquette_id is not null)                            as suivi_lies,
  (select count(*) from public.suivi where raquette_id is null and coalesce(trim(raquette), '') <> '') as suivi_non_lies,
  (select count(*) from public.tournoi_raquettes where raquette_id is not null)                as tournoi_lies;
