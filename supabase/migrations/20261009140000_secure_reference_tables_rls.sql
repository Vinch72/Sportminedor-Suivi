-- ════════════════════════════════════════════════════════════════════════════
-- Sécurité (fin) : tables de référence.
-- Avant : "authenticated" = ALL true → un compte club partenaire pouvait
-- modifier tarifs, tournois, cordages, compteurs bobines des clubs…
-- Après : staff = tout ; club partenaire et anon = lecture seule de ce dont
-- /portal et /tournoi ont besoin.
-- Nécessite la migration 20261009120000 (fonction is_staff).
-- À exécuter dans Supabase > SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('app_settings', 'clubs', 'cordages', 'cordeur', 'payment_modes',
                               'statuts', 'tarif_matrix', 'tournoi_cordages',
                               'tournoi_cordeurs', 'tournois') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

do $$
declare t text;
begin
  -- Staff : accès complet
  foreach t in array array['app_settings', 'clubs', 'cordages', 'cordeur', 'payment_modes',
                           'statuts', 'tarif_matrix', 'tournoi_cordages',
                           'tournoi_cordeurs', 'tournois'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
      t || '_staff_all', t);
  end loop;

  -- Lecture seule pour anon (/tournoi) et clubs partenaires (/portal)
  foreach t in array array['clubs', 'cordages', 'statuts', 'tarif_matrix',
                           'tournoi_cordages', 'tournois'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                   t || '_public_read', t);
  end loop;
end $$;

-- ── Contrôle : tables publiques SANS RLS ───────────────────────────────────
select c.relname as table_sans_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;
