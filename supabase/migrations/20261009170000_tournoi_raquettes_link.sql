-- ════════════════════════════════════════════════════════════════════════════
-- Raquettes de tournoi liées à la table raquettes (additif)
-- • tournoi_raquettes.raquette_id facultatif (le texte "raquette" reste)
-- • page publique /tournoi (QR) : les raquettes du client sont proposées,
--   le dépôt lie / crée la raquette et y mémorise cordage + tension
-- • fix : le club choisi sur la page de dépôt est de nouveau pris en compte
-- Nécessite 20261009160000_raquettes.sql. SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.tournoi_raquettes
  add column if not exists raquette_id uuid references public.raquettes(id) on delete set null;

create index if not exists tournoi_raquettes_raquette_id_idx on public.tournoi_raquettes (raquette_id);

-- ── 1. Recherche par numéro exact : + raquettes enregistrées du client ─────
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
      'cordage', c.cordage, 'tension', c.tension, 'club', c.club,
      'raquettes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id, 'brand', r.brand, 'model', r.model,
          'pref_cordage_id', r.pref_cordage_id, 'pref_tension', r.pref_tension)
          order by r.created_at desc)
        from public.raquettes r where r.client_id = c.id
      ), '[]'::jsonb)))
    from public.clients c
    where c.phone = p_phone
  ), '[]'::jsonb);
end;
$$;

-- ── 2. Dépôt : nouvelle signature (p_raquette_id, p_club facultatifs) ──────
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           where p.proname = 'public_deposit_racket' and p.pronamespace = 'public'::regnamespace loop
    execute 'drop function ' || f.sig;
  end loop;
end $$;

create function public.public_deposit_racket(
  p_phone        text,
  p_client_id    public.clients.id%type,
  p_tournoi      public.tournoi_raquettes.tournoi%type,
  p_cordage_id   public.tournoi_raquettes.cordage_id%type,
  p_cordage_text public.tournoi_raquettes.cordage_text%type,
  p_tension      public.tournoi_raquettes.tension%type,
  p_raquette     public.tournoi_raquettes.raquette%type,
  p_notes        public.tournoi_raquettes.notes%type,
  p_fourni       boolean,
  p_raquette_id  uuid default null,
  p_club         public.tournoi_raquettes.club_id%type default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c public.clients;
  v_cordeur  public.tournoi_raquettes.cordeur_id%type;
  v_club     public.tournoi_raquettes.club_id%type;
  v_rq_id    uuid;
  v_rq_txt   text := upper(trim(coalesce(p_raquette::text, '')));
  v_cordage  public.clients.cordage%type;
  v_tension  public.clients.tension%type;
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

  -- Club : celui choisi sur la page (s'il existe), sinon celui de la fiche
  v_club := c.club;
  if p_club is not null and exists (select 1 from public.clubs where clubs = p_club::text) then
    v_club := p_club;
  end if;

  -- Cordeur auto si un seul cordeur affecté au tournoi
  if (select count(*) from public.tournoi_cordeurs where tournoi = p_tournoi) = 1 then
    select cordeur into v_cordeur from public.tournoi_cordeurs where tournoi = p_tournoi;
  end if;

  -- Raquette : celle choisie (si c'est bien celle du client), sinon même
  -- libellé chez le client, sinon créée à partir du texte saisi
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

  insert into public.tournoi_raquettes (
    tournoi, client_id, cordage_id, cordage_text, tension, raquette, raquette_id, notes,
    club_id, cordeur_id, fourni, statut_id, exported
  ) values (
    p_tournoi, c.id, p_cordage_id, left(p_cordage_text, 200), p_tension,
    left(p_raquette, 200), v_rq_id, left(p_notes, 1000),
    v_club, v_cordeur, coalesce(p_fourni, false), 'A FAIRE', false
  );

  -- Mémorise cordage (catalogue uniquement) + tension sur la raquette
  if v_rq_id is not null then
    update public.raquettes
       set pref_cordage_id = coalesce(p_cordage_id::text, pref_cordage_id),
           pref_tension    = coalesce(nullif(p_tension::text, ''), pref_tension)
     where id = v_rq_id;
  end if;

  -- Fiche client : cordage (texte libre si fourni) + tension
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

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           where p.proname = 'public_deposit_racket' and p.pronamespace = 'public'::regnamespace loop
    execute 'revoke all on function ' || f.sig || ' from public';
    execute 'grant execute on function ' || f.sig || ' to anon, authenticated';
  end loop;
end $$;
