-- ════════════════════════════════════════════════════════════════════════════
-- SNAPSHOT : une ligne saisie ne dépend plus des fiches qui changent ensuite
-- • suivi / tournoi_raquettes : plus de lien obligatoire vers cordages
--   → le nom du cordage reste écrit sur la ligne, même si on supprime le cordage
-- • suivi.gain_magasin_cordage_cents : gain magasin du cordage figé à la saisie
-- • tournoi_raquettes.cordage_is_base : basique/spécifique figé à la saisie
--   (sert au calcul du prix tournoi)
-- • figés automatiquement à l'insertion (trigger) et quand on change le
--   cordage de la ligne ; les anciennes lignes reçoivent la valeur actuelle
-- • renommer un cordage (rename_cordage) corrige toujours le nom partout
-- • merge_cordage (« remplacer par… ») devient inutile → supprimée
-- SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Plus de lien obligatoire lignes → cordages ──────────────────────────
alter table public.suivi             drop constraint if exists suivi_cordage_id_fkey;
alter table public.tournoi_raquettes drop constraint if exists tournoi_raquettes_cordage_id_fkey;

-- ── 2. Colonnes figées ─────────────────────────────────────────────────────
alter table public.suivi             add column if not exists gain_magasin_cordage_cents integer;
alter table public.tournoi_raquettes add column if not exists cordage_is_base boolean;

-- ── 3. Figer automatiquement ───────────────────────────────────────────────
create or replace function public.suivi_snapshot_cordage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Renommage (rename_cordage) : même cordage, on ne refige pas
  if coalesce(current_setting('app.cordage_rename', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' or new.cordage_id is distinct from old.cordage_id then
    new.gain_magasin_cordage_cents :=
      (select c.gain_magasin_cents from public.cordages c where c.cordage = new.cordage_id);
  end if;
  return new;
end;
$$;

drop trigger if exists suivi_snapshot_cordage on public.suivi;
create trigger suivi_snapshot_cordage
  before insert or update of cordage_id on public.suivi
  for each row execute function public.suivi_snapshot_cordage();

create or replace function public.tournoi_raquettes_snapshot_cordage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.cordage_rename', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' or new.cordage_id is distinct from old.cordage_id then
    new.cordage_is_base :=
      (select c.is_base from public.cordages c where c.cordage = new.cordage_id);
  end if;
  return new;
end;
$$;

drop trigger if exists tournoi_raquettes_snapshot_cordage on public.tournoi_raquettes;
create trigger tournoi_raquettes_snapshot_cordage
  before insert or update of cordage_id on public.tournoi_raquettes
  for each row execute function public.tournoi_raquettes_snapshot_cordage();

-- ── 4. Anciennes lignes : valeur actuelle ──────────────────────────────────
update public.suivi s
   set gain_magasin_cordage_cents = c.gain_magasin_cents
  from public.cordages c
 where c.cordage = s.cordage_id and s.gain_magasin_cordage_cents is null;

update public.tournoi_raquettes t
   set cordage_is_base = c.is_base
  from public.cordages c
 where c.cordage = t.cordage_id and t.cordage_is_base is null;

-- ── 5. rename_cordage : corrige le nom partout SANS refiger les valeurs ─────
create or replace function public.rename_cordage(p_old text, p_new text)
returns void
language plpgsql
security invoker            -- RLS appliquée : staff uniquement
set search_path = public
as $fn$
declare
  v_new text := trim(p_new);
begin
  if not public.is_staff() then
    raise exception 'Accès refusé';
  end if;
  if coalesce(v_new, '') = '' then
    raise exception 'Nom du cordage requis';
  end if;
  if v_new = p_old then
    return;
  end if;
  if exists (select 1 from public.cordages where cordage = v_new) then
    raise exception 'Un cordage « % » existe déjà', v_new;
  end if;

  perform set_config('app.cordage_rename', 'on', true);   -- jusqu'à la fin de la transaction

  insert into public.cordages
  select (jsonb_populate_record(null::public.cordages,
                                to_jsonb(c) || jsonb_build_object('cordage', v_new))).*
  from public.cordages c
  where c.cordage = p_old;
  if not found then
    raise exception 'Cordage « % » introuvable', p_old;
  end if;

  update public.suivi             set cordage_id      = v_new where cordage_id      = p_old;
  update public.tournoi_raquettes set cordage_id      = v_new where cordage_id      = p_old;
  update public.tournoi_cordages  set cordage_id      = v_new where cordage_id      = p_old;
  update public.clients           set cordage         = v_new where cordage         = p_old;
  update public.raquettes         set pref_cordage_id = v_new where pref_cordage_id = p_old;

  delete from public.cordages where cordage = p_old;

  perform set_config('app.cordage_rename', 'off', true);
end;
$fn$;

revoke all on function public.rename_cordage(text, text) from public, anon;
grant execute on function public.rename_cordage(text, text) to authenticated;

-- ── 6. « Remplacer par… » n'a plus lieu d'être ─────────────────────────────
drop function if exists public.merge_cordage(text, text);

commit;

-- ── Bilan ──────────────────────────────────────────────────────────────────
select
  (select count(*) from public.suivi where gain_magasin_cordage_cents is not null)   as suivi_gain_fige,
  (select count(*) from public.suivi where cordage_id is not null
                                       and gain_magasin_cordage_cents is null)       as suivi_sans_gain_cordage,
  (select count(*) from public.tournoi_raquettes where cordage_is_base is not null)  as tournoi_categorie_figee,
  (select count(*) from pg_constraint where conname in ('suivi_cordage_id_fkey', 'tournoi_raquettes_cordage_id_fkey')) as liens_restants;
