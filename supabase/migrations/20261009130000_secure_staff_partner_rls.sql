-- ════════════════════════════════════════════════════════════════════════════
-- Sécurité (suite) : les comptes clubs partenaires sont "authenticated" et
-- avaient un accès total à suivi / tournoi_raquettes / tournoi_ventes.
-- → staff : tout ; club partenaire : uniquement ses propres données.
-- Nécessite la migration 20261009120000 (fonction is_staff).
-- À exécuter dans Supabase > SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Helpers : identité du club partenaire connecté ─────────────────────────
create or replace function public.my_partner_id()
returns public.partner_users.id%type
language sql
stable
security definer
set search_path = public
as $$
  select id from public.partner_users where user_id = auth.uid() limit 1;
$$;

create or replace function public.my_partner_club()
returns public.partner_users.club_id%type
language sql
stable
security definer
set search_path = public
as $$
  select club_id from public.partner_users where user_id = auth.uid() limit 1;
$$;

revoke all on function public.my_partner_id() from public;
revoke all on function public.my_partner_club() from public;
grant execute on function public.my_partner_id() to authenticated;
grant execute on function public.my_partner_club() to authenticated;

-- ── Supprime toutes les policies existantes des tables traitées ici ────────
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('suivi', 'tournoi_raquettes', 'tournoi_ventes',
                               'partner_orders', 'partner_deliveries', 'partner_notifications',
                               'partner_season_orders', 'partner_season_order_lines',
                               'partner_catalog') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.suivi                      enable row level security;
alter table public.tournoi_raquettes          enable row level security;
alter table public.tournoi_ventes             enable row level security;
alter table public.partner_orders             enable row level security;
alter table public.partner_deliveries         enable row level security;
alter table public.partner_notifications      enable row level security;
alter table public.partner_season_orders      enable row level security;
alter table public.partner_season_order_lines enable row level security;
alter table public.partner_catalog            enable row level security;

-- ── Staff : accès complet partout ──────────────────────────────────────────
create policy suivi_staff_all on public.suivi
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy tournoi_raquettes_staff_all on public.tournoi_raquettes
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy tournoi_ventes_staff_all on public.tournoi_ventes
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy partner_orders_staff_all on public.partner_orders
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy partner_deliveries_staff_all on public.partner_deliveries
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy partner_notifications_staff_all on public.partner_notifications
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy partner_season_orders_staff_all on public.partner_season_orders
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy partner_season_order_lines_staff_all on public.partner_season_order_lines
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy partner_catalog_staff_all on public.partner_catalog
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Club partenaire : uniquement ses données (besoins du portail /portal) ──
-- suivi : lecture des raquettes de son club (consommation bobine)
create policy suivi_partner_select on public.suivi
  for select to authenticated
  using (public.my_partner_club() is not null and club_id = public.my_partner_club());

-- commandes : lecture / création / modification / suppression des siennes
create policy partner_orders_partner_all on public.partner_orders
  for all to authenticated
  using (partner_user_id = public.my_partner_id())
  with check (partner_user_id = public.my_partner_id());

-- livraisons : lecture / création / suppression des siennes
create policy partner_deliveries_partner_select on public.partner_deliveries
  for select to authenticated using (partner_user_id = public.my_partner_id());
create policy partner_deliveries_partner_insert on public.partner_deliveries
  for insert to authenticated with check (partner_user_id = public.my_partner_id());
create policy partner_deliveries_partner_delete on public.partner_deliveries
  for delete to authenticated using (partner_user_id = public.my_partner_id());

-- notifications : création, lecture, marquage "lu" des siennes
create policy partner_notifications_partner_select on public.partner_notifications
  for select to authenticated using (partner_user_id = public.my_partner_id());
create policy partner_notifications_partner_insert on public.partner_notifications
  for insert to authenticated with check (partner_user_id = public.my_partner_id());
create policy partner_notifications_partner_update on public.partner_notifications
  for update to authenticated
  using (partner_user_id = public.my_partner_id())
  with check (partner_user_id = public.my_partner_id());

-- commande de saison + lignes : lecture des siennes
create policy partner_season_orders_partner_select on public.partner_season_orders
  for select to authenticated using (partner_user_id = public.my_partner_id());
create policy partner_season_order_lines_partner_select on public.partner_season_order_lines
  for select to authenticated
  using (exists (select 1 from public.partner_season_orders so
                 where so.id = season_order_id and so.partner_user_id = public.my_partner_id()));

-- catalogue : lecture des articles actifs
create policy partner_catalog_partner_select on public.partner_catalog
  for select to authenticated
  using (public.my_partner_id() is not null and active);

-- ── Contrôle 1 : tables publiques SANS RLS (ouvertes selon les GRANT) ──────
select c.relname as table_sans_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;
