-- ════════════════════════════════════════════════════════════════════════════
-- Remplacer un cordage par un autre (puis supprimer l'ancien)
-- Pour supprimer un cordage déjà utilisé (ex. doublon / faute de frappe) :
-- toutes les références passent sur le cordage de remplacement.
-- Une seule transaction : tout ou rien. SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.merge_cordage(p_old text, p_into text)
returns void
language plpgsql
security invoker            -- RLS appliquée : staff uniquement
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Accès refusé';
  end if;
  if p_old is null or p_into is null or p_old = p_into then
    raise exception 'Choisis un cordage de remplacement différent';
  end if;
  if not exists (select 1 from public.cordages where cordage = p_old) then
    raise exception 'Cordage « % » introuvable', p_old;
  end if;
  if not exists (select 1 from public.cordages where cordage = p_into) then
    raise exception 'Cordage « % » introuvable', p_into;
  end if;

  update public.suivi             set cordage_id      = p_into where cordage_id      = p_old;
  update public.tournoi_raquettes set cordage_id      = p_into where cordage_id      = p_old;
  update public.clients           set cordage         = p_into where cordage         = p_old;
  update public.raquettes         set pref_cordage_id = p_into where pref_cordage_id = p_old;

  -- tournoi_cordages : pas de doublon si le tournoi proposait déjà les deux
  delete from public.tournoi_cordages o
   where o.cordage_id = p_old
     and exists (select 1 from public.tournoi_cordages t where t.tournoi = o.tournoi and t.cordage_id = p_into);
  update public.tournoi_cordages set cordage_id = p_into where cordage_id = p_old;

  delete from public.cordages where cordage = p_old;
end;
$$;

revoke all on function public.merge_cordage(text, text) from public, anon;
grant execute on function public.merge_cordage(text, text) to authenticated;
