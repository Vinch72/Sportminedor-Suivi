-- ════════════════════════════════════════════════════════════════════════════
-- Renommage d'un cordage (le nom est la clé : cordages.cordage)
-- Les FK suivi / tournoi_raquettes n'ont pas ON UPDATE CASCADE → on crée la
-- ligne au nouveau nom, on bascule toutes les références, puis on supprime
-- l'ancienne. Une seule transaction : tout ou rien.
-- Aucune table modifiée. À exécuter dans Supabase > SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

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

  -- 1. Copie de la ligne (toutes colonnes) sous le nouveau nom
  insert into public.cordages
  select (jsonb_populate_record(null::public.cordages,
                                to_jsonb(c) || jsonb_build_object('cordage', v_new))).*
  from public.cordages c
  where c.cordage = p_old;
  if not found then
    raise exception 'Cordage « % » introuvable', p_old;
  end if;

  -- 2. Bascule des références
  update public.suivi             set cordage_id = v_new where cordage_id = p_old;
  update public.tournoi_raquettes set cordage_id = v_new where cordage_id = p_old;
  update public.tournoi_cordages  set cordage_id = v_new where cordage_id = p_old;
  update public.clients           set cordage    = v_new where cordage    = p_old;

  -- 3. Suppression de l'ancien nom
  delete from public.cordages where cordage = p_old;
end;
$$;

revoke all on function public.rename_cordage(text, text) from public, anon;
grant execute on function public.rename_cordage(text, text) to authenticated;
