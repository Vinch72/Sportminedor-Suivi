-- ════════════════════════════════════════════════════════════════════════════
-- Raquettes des clients (comme Stringflow) — mode ADDITIF
-- • nouvelle table raquettes (liée au client)
-- • suivi.raquette_id facultatif ; suivi.raquette (texte) reste la référence
--   d'affichage et continue d'être rempli.
-- Nécessite les migrations 20261009120000 (is_staff) et 20261009150000.
-- À exécuter dans Supabase > SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.raquettes (
  id              uuid primary key default gen_random_uuid(),
  client_id       text not null references public.clients(id) on delete cascade,
  sport           text not null default 'badminton',
  brand           text,
  model           text not null,
  pref_cordage_id text references public.cordages(cordage) on delete set null,
  pref_tension    text,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists raquettes_client_id_idx on public.raquettes (client_id);

alter table public.suivi
  add column if not exists raquette_id uuid references public.raquettes(id) on delete set null;

create index if not exists suivi_raquette_id_idx on public.suivi (raquette_id);

-- ── RLS : staff uniquement ─────────────────────────────────────────────────
alter table public.raquettes enable row level security;

drop policy if exists raquettes_staff_all on public.raquettes;
create policy raquettes_staff_all on public.raquettes
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── rename_cordage : bascule aussi le cordage préféré des raquettes ────────
create or replace function public.rename_cordage(p_old text, p_new text)
returns void
language plpgsql
security invoker            -- RLS appliquée : staff uniquement
set search_path = public
as $$
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
end;
$$;

revoke all on function public.rename_cordage(text, text) from public, anon;
grant execute on function public.rename_cordage(text, text) to authenticated;
