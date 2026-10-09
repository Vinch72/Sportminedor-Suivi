-- ════════════════════════════════════════════════════════════════════════════
-- Dépôt casier par QR code (comme Stringflow)
-- • QR collé sur le casier d'un club → /depot?c=<depot_token du club>
-- • le joueur crée un « dépôt en attente » (depot_casier) via RPC publique
-- • le magasin le transforme en ligne de suivi depuis la page Clubs
-- • message affichable par club sur la page de dépôt (avec dates)
-- Lignes figées (snapshot) : noms client / raquette / cordage écrits sur la ligne.
-- SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Clubs : identifiant de casier fixe (QR) + message ───────────────────
-- Le QR contient depot_token (et non le nom) : renommer un club ne casse pas
-- les QR déjà imprimés.
alter table public.clubs
  add column if not exists depot_token          uuid not null default gen_random_uuid(),
  add column if not exists notification_message text,
  add column if not exists notification_start   date,
  add column if not exists notification_end     date;

create unique index if not exists clubs_depot_token_key on public.clubs (depot_token);

-- ── 2. Dépôts casier ───────────────────────────────────────────────────────
create table if not exists public.depot_casier (
  id             uuid primary key default gen_random_uuid(),
  club_id        text not null,                 -- club du casier (nom, figé)
  client_club    text,                          -- club du joueur (prix bobines)
  client_id      text references public.clients(id) on delete set null,
  client_name    text,
  client_phone   text,
  raquette_id    uuid references public.raquettes(id) on delete set null,
  raquette_label text,
  cordage_id     text,                          -- nom du cordage (figé, pas de lien)
  cordage_text   text,                          -- cordage fourni (texte libre)
  tension        text,
  notes          text,
  fourni         boolean not null default false,
  date_depot     timestamptz not null default now(),
  converted      boolean not null default false,
  converted_at   timestamptz,
  suivi_id       uuid
);

create index if not exists depot_casier_pending_idx on public.depot_casier (converted, club_id);

alter table public.depot_casier enable row level security;
drop policy if exists depot_casier_staff_all on public.depot_casier;
create policy depot_casier_staff_all on public.depot_casier
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Temps réel (badge du menu)
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'depot_casier') then
    execute 'alter publication supabase_realtime add table public.depot_casier';
  end if;
end $$;

-- ── 3. RPC publique de dépôt ───────────────────────────────────────────────
create or replace function public.public_depot_casier(
  p_phone        text,
  p_client_id    public.clients.id%type,
  p_club         text,
  p_client_club  text,
  p_cordage_id   text,
  p_cordage_text text,
  p_tension      text,
  p_raquette     text,
  p_raquette_id  uuid,
  p_notes        text,
  p_fourni       boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c        public.clients;
  v_rq_id  uuid;
  v_rq_txt text := upper(trim(coalesce(p_raquette, '')));
  v_cord   text := nullif(trim(coalesce(p_cordage_id, '')), '');
  v_cclub  text;
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

  if not exists (select 1 from public.clubs where clubs = p_club) then
    raise exception 'Club introuvable';
  end if;

  -- Club du joueur : celui choisi (s'il existe), sinon sa fiche, sinon le casier
  v_cclub := coalesce(
    (select clubs from public.clubs where clubs = p_client_club),
    c.club::text,
    p_club);

  -- Cordage : uniquement un cordage du catalogue (sinon fourni / texte libre)
  if v_cord is not null and not exists (select 1 from public.cordages where cordage = v_cord) then
    v_cord := null;
  end if;

  -- Raquette : choisie (si c'est celle du client), sinon même libellé, sinon créée
  if p_raquette_id is not null then
    select id into v_rq_id from public.raquettes where id = p_raquette_id and client_id = c.id;
  end if;
  if v_rq_id is null and v_rq_txt <> '' then
    select id into v_rq_id from public.raquettes
     where client_id = c.id
       and (upper(model) = v_rq_txt or upper(concat_ws(' ', brand, model)) = v_rq_txt)
     order by created_at desc limit 1;
    if v_rq_id is null then
      insert into public.raquettes (client_id, model)
      values (c.id, left(v_rq_txt, 200))
      returning id into v_rq_id;
    end if;
  end if;

  insert into public.depot_casier (
    club_id, client_club, client_id, client_name, client_phone,
    raquette_id, raquette_label, cordage_id, cordage_text, tension, notes, fourni
  ) values (
    p_club, v_cclub, c.id, trim(concat_ws(' ', upper(c.nom), c.prenom)), c.phone,
    v_rq_id, nullif(left(v_rq_txt, 200), ''), v_cord, left(nullif(trim(p_cordage_text), ''), 200),
    left(nullif(trim(p_tension), ''), 50), left(nullif(trim(p_notes), ''), 1000), coalesce(p_fourni, false)
  );

  -- Mémorise cordage + tension sur la raquette
  if v_rq_id is not null then
    update public.raquettes
       set pref_cordage_id = coalesce(v_cord, pref_cordage_id),
           pref_tension    = coalesce(nullif(trim(p_tension), ''), pref_tension)
     where id = v_rq_id;
  end if;

  -- Fiche client : cordage + tension
  v_cordage := c.cordage;
  v_tension := c.tension;
  if coalesce(v_cord, nullif(trim(p_cordage_text), '')) is not null then
    v_cordage := coalesce(v_cord, trim(p_cordage_text));
  end if;
  if nullif(trim(p_tension), '') is not null then
    v_tension := trim(p_tension);
  end if;
  update public.clients set cordage = v_cordage, tension = v_tension where id = c.id;
end;
$$;

revoke all on function public.public_depot_casier(text, public.clients.id%type, text, text, text, text, text, text, uuid, text, boolean) from public;
grant execute on function public.public_depot_casier(text, public.clients.id%type, text, text, text, text, text, text, uuid, text, boolean) to anon, authenticated;
