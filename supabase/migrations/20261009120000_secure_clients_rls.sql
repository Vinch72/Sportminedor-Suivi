-- ════════════════════════════════════════════════════════════════════════════
-- Sécurité : clients / partner_users ne sont plus lisibles par anon ni par les
-- comptes clubs partenaires. La page publique /tournoi passe par des RPC
-- SECURITY DEFINER limitées à un numéro de téléphone exact.
-- À exécuter dans Supabase > SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Helper : l'utilisateur connecté est-il un membre du staff du magasin ? ──
-- Les inscriptions publiques sont désactivées : un compte connecté est soit
-- staff, soit club partenaire (présent dans partner_users).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'partner'
     and not exists (select 1 from public.partner_users pu where pu.user_id = auth.uid());
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- ── clients : staff uniquement ──────────────────────────────────────────────
alter table public.clients enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'clients' loop
    execute format('drop policy %I on public.clients', p.policyname);
  end loop;
end $$;

create policy clients_staff_all on public.clients
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── partner_users : staff + le club pour sa propre ligne ────────────────────
alter table public.partner_users enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'partner_users' loop
    execute format('drop policy %I on public.partner_users', p.policyname);
  end loop;
end $$;

create policy partner_users_staff_all on public.partner_users
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy partner_users_self_select on public.partner_users
  for select to authenticated
  using (user_id = auth.uid());

-- ── tournoi_raquettes : le dépôt public passe désormais par la RPC ──────────
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'tournoi_raquettes' and roles = '{anon}' loop
    execute format('drop policy %I on public.tournoi_raquettes', p.policyname);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- RPC publiques (page /tournoi)
-- ════════════════════════════════════════════════════════════════════════════

-- Numéro mobile FR : 06/07XXXXXXXX ou +336/+337XXXXXXXX, rien d'autre.
create or replace function public._is_valid_mobile(p_phone text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_phone ~ '^(0[67][0-9]{8}|\+33[67][0-9]{8})$', false);
$$;

-- 1. Recherche des fiches correspondant EXACTEMENT à un numéro
create or replace function public.public_find_clients_by_phone(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._is_valid_mobile(p_phone) then
    raise exception 'Numéro invalide';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'nom', c.nom, 'prenom', c.prenom, 'phone', c.phone,
      'cordage', c.cordage, 'tension', c.tension, 'club', c.club))
    from public.clients c
    where c.phone = p_phone
  ), '[]'::jsonb);
end;
$$;

-- 2. Création d'une fiche client depuis la page publique
create or replace function public.public_create_client(
  p_nom    text,
  p_prenom text,
  p_phone  text,
  p_club   public.clients.club%type
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare c public.clients;
begin
  if not public._is_valid_mobile(p_phone) then
    raise exception 'Numéro invalide';
  end if;
  if coalesce(trim(p_nom), '') = '' or coalesce(trim(p_prenom), '') = '' or p_club is null then
    raise exception 'Nom, prénom et club requis';
  end if;

  insert into public.clients (nom, prenom, phone, club)
  values (left(trim(p_nom), 100), left(trim(p_prenom), 100), p_phone, p_club)
  returning * into c;

  return jsonb_build_object(
    'id', c.id, 'nom', c.nom, 'prenom', c.prenom, 'phone', c.phone,
    'cordage', c.cordage, 'tension', c.tension, 'club', c.club);
end;
$$;

-- 3. Dépôt d'une raquette en tournoi (+ mise à jour cordage/tension du client)
--    Le client doit correspondre au numéro fourni.
create or replace function public.public_deposit_racket(
  p_phone        text,
  p_client_id    public.clients.id%type,
  p_tournoi      public.tournoi_raquettes.tournoi%type,
  p_cordage_id   public.tournoi_raquettes.cordage_id%type,
  p_cordage_text public.tournoi_raquettes.cordage_text%type,
  p_tension      public.tournoi_raquettes.tension%type,
  p_raquette     public.tournoi_raquettes.raquette%type,
  p_notes        public.tournoi_raquettes.notes%type,
  p_fourni       boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c public.clients;
  v_cordeur public.tournoi_raquettes.cordeur_id%type;
  v_cordage public.clients.cordage%type;
  v_tension public.clients.tension%type;
begin
  if not public._is_valid_mobile(p_phone) then
    raise exception 'Numéro invalide';
  end if;

  select * into c from public.clients where id = p_client_id and phone = p_phone;
  if not found then
    raise exception 'Client introuvable';
  end if;

  if not exists (select 1 from public.tournois t where t.tournoi = p_tournoi) then
    raise exception 'Tournoi introuvable';
  end if;

  -- Cordeur auto si un seul cordeur affecté au tournoi
  if (select count(*) from public.tournoi_cordeurs where tournoi = p_tournoi) = 1 then
    select cordeur into v_cordeur from public.tournoi_cordeurs where tournoi = p_tournoi;
  end if;

  insert into public.tournoi_raquettes (
    tournoi, client_id, cordage_id, cordage_text, tension, raquette, notes,
    club_id, cordeur_id, fourni, statut_id, exported
  ) values (
    p_tournoi, c.id, p_cordage_id, left(p_cordage_text, 200), p_tension,
    left(p_raquette, 200), left(p_notes, 1000),
    c.club, v_cordeur, coalesce(p_fourni, false), 'A FAIRE', false
  );

  -- Mise à jour fiche client : cordage (texte libre si fourni) + tension
  -- (affectation PL/pgSQL = conversion vers le type des colonnes de clients)
  v_cordage := c.cordage;
  v_tension := c.tension;
  if nullif(coalesce(p_cordage_id::text, p_cordage_text), '') is not null then
    v_cordage := coalesce(p_cordage_id::text, p_cordage_text);
  end if;
  if nullif(p_tension::text, '') is not null then
    v_tension := p_tension::text;
  end if;
  update public.clients set cordage = v_cordage, tension = v_tension where id = c.id;
end;
$$;

revoke all on function public._is_valid_mobile(text) from public;
revoke all on function public.public_find_clients_by_phone(text) from public;
revoke all on function public.public_create_client(text, text, text, public.clients.club%type) from public;
revoke all on function public.public_deposit_racket(
  text, public.clients.id%type, public.tournoi_raquettes.tournoi%type,
  public.tournoi_raquettes.cordage_id%type, public.tournoi_raquettes.cordage_text%type,
  public.tournoi_raquettes.tension%type, public.tournoi_raquettes.raquette%type,
  public.tournoi_raquettes.notes%type, boolean) from public;

grant execute on function public._is_valid_mobile(text) to anon, authenticated;
grant execute on function public.public_find_clients_by_phone(text) to anon, authenticated;
grant execute on function public.public_create_client(text, text, text, public.clients.club%type) to anon, authenticated;
grant execute on function public.public_deposit_racket(
  text, public.clients.id%type, public.tournoi_raquettes.tournoi%type,
  public.tournoi_raquettes.cordage_id%type, public.tournoi_raquettes.cordage_text%type,
  public.tournoi_raquettes.tension%type, public.tournoi_raquettes.raquette%type,
  public.tournoi_raquettes.notes%type, boolean) to anon, authenticated;

-- ── Contrôle : policies restantes sur les tables sensibles ─────────────────
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('clients', 'partner_users', 'tournoi_raquettes', 'suivi', 'profiles',
                    'partner_orders', 'partner_deliveries', 'partner_notifications',
                    'partner_season_orders', 'partner_season_order_lines', 'tournoi_ventes')
order by tablename, policyname;
