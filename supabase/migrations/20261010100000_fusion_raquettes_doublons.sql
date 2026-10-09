-- ════════════════════════════════════════════════════════════════════════════
-- Fusion des raquettes en double (cas évidents)
-- Chez un MÊME client, 2 raquettes dont « marque + modèle » est identique une
-- fois retirés espaces / points / tirets / barres (ex. ASTROX 88S = ASTROX 88 S
-- = ASTROX-88S) → on garde UNE raquette :
--   1) celle qui a une marque renseignée (saisie à la main), sinon
--   2) la plus utilisée (suivi + tournois), sinon 3) la plus récente.
-- • les lignes suivi / tournoi_raquettes sont rattachées à la raquette gardée
-- • cordage / tension / notes manquants sur la gardée : repris des doublons
-- • les textes "raquette" du suivi ne bougent pas
-- • ANNULABLE : 20261010100100_fusion_raquettes_doublons_undo.sql
-- SQL Editor → « Run without RLS » (tables temporaires). Relançable.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Journaux pour l'annulation (RLS sans policy : invisibles pour l'app)
create table if not exists public.raquettes_merge_log (     -- raquettes supprimées
  merged_id uuid primary key, kept_id uuid not null, row jsonb not null, merged_at timestamptz not null default now());
create table if not exists public.raquettes_merge_kept (    -- état avant fusion des gardées
  id uuid primary key, row jsonb not null);
create table if not exists public.raquettes_merge_links (   -- liens déplacés
  tbl text not null, row_id text not null, old_raquette_id uuid not null, new_raquette_id uuid not null,
  merged_at timestamptz not null default now());
alter table public.raquettes_merge_log   enable row level security;
alter table public.raquettes_merge_kept  enable row level security;
alter table public.raquettes_merge_links enable row level security;

-- Clé de comparaison : majuscules, uniquement lettres A-Z et chiffres
create or replace function pg_temp.rq_key(t text) returns text
language sql immutable as $$
  select regexp_replace(upper(coalesce(t, '')), '[^A-Z0-9]', '', 'g');
$$;

create temp table rq_k on commit drop as
select r.id, r.client_id, pg_temp.rq_key(concat_ws(' ', r.brand, r.model)) as k,
       r.brand, r.created_at,
       (select count(*) from public.suivi s where s.raquette_id = r.id)
     + (select count(*) from public.tournoi_raquettes t where t.raquette_id = r.id) as uses
from public.raquettes r;

delete from rq_k where length(k) < 2;

create temp table rq_keep on commit drop as
select distinct on (client_id, k) client_id, k, id as keep_id
from rq_k
order by client_id, k, (brand is not null) desc, uses desc, created_at desc;

create temp table rq_merge on commit drop as
select r.id as merged_id, kp.keep_id
from rq_k r join rq_keep kp using (client_id, k)
where r.id <> kp.keep_id;

-- Journal
insert into public.raquettes_merge_log (merged_id, kept_id, row)
select m.merged_id, m.keep_id, to_jsonb(r)
from rq_merge m join public.raquettes r on r.id = m.merged_id
on conflict (merged_id) do nothing;

insert into public.raquettes_merge_kept (id, row)
select r.id, to_jsonb(r)
from public.raquettes r where r.id in (select keep_id from rq_merge)
on conflict (id) do nothing;

insert into public.raquettes_merge_links (tbl, row_id, old_raquette_id, new_raquette_id)
select 'suivi', s.id::text, s.raquette_id, m.keep_id
from public.suivi s join rq_merge m on s.raquette_id = m.merged_id;

insert into public.raquettes_merge_links (tbl, row_id, old_raquette_id, new_raquette_id)
select 'tournoi_raquettes', t.id::text, t.raquette_id, m.keep_id
from public.tournoi_raquettes t join rq_merge m on t.raquette_id = m.merged_id;

-- Rattachement des lignes
update public.suivi s set raquette_id = m.keep_id
  from rq_merge m where s.raquette_id = m.merged_id;
update public.tournoi_raquettes t set raquette_id = m.keep_id
  from rq_merge m where t.raquette_id = m.merged_id;

-- Compléter la raquette gardée avec les infos des doublons (la plus récente)
update public.raquettes k set
  pref_cordage_id = coalesce(k.pref_cordage_id, (
    select r.pref_cordage_id from public.raquettes r join rq_merge m on m.merged_id = r.id
    where m.keep_id = k.id and r.pref_cordage_id is not null order by r.created_at desc limit 1)),
  pref_tension = coalesce(k.pref_tension, (
    select r.pref_tension from public.raquettes r join rq_merge m on m.merged_id = r.id
    where m.keep_id = k.id and r.pref_tension is not null order by r.created_at desc limit 1)),
  notes = coalesce(k.notes, (
    select r.notes from public.raquettes r join rq_merge m on m.merged_id = r.id
    where m.keep_id = k.id and r.notes is not null order by r.created_at desc limit 1))
where k.id in (select keep_id from rq_merge);

-- Suppression des doublons
delete from public.raquettes where id in (select merged_id from rq_merge);

commit;

-- ── Bilan : exemples de fusions (gardée ← supprimée) ───────────────────────
select
  (select count(*) from public.raquettes_merge_log)          as raquettes_fusionnees_total,
  (select count(*) from public.raquettes)                    as raquettes_restantes,
  (select string_agg(x, '  |  ') from (
     select concat_ws(' ', k.brand, k.model) || ' ← ' || concat_ws(' ', l.row->>'brand', l.row->>'model') as x
     from public.raquettes_merge_log l join public.raquettes k on k.id = l.kept_id
     order by l.merged_at desc limit 15) e)                  as exemples;
