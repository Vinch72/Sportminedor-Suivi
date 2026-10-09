-- ════════════════════════════════════════════════════════════════════════════
-- Infos cordage : Victor VS 69 et VS-63 (garnitures unitaires Victor)
-- • VS-69 : 0,69 mm, toucher doux, contrôle et durabilité élevés (fiche revendeur)
-- • VS-63 : 0,63 mm, profil du VBS-63 (fin, répulsion élevée, durabilité faible)
--   — estimation : aucune fiche officielle trouvée pour la version VS
-- • VS-53 : aucune information trouvée → laissé vide
-- Ne remplit que si le cordage n'a encore aucune info. SQL Editor. Relançable.
-- ════════════════════════════════════════════════════════════════════════════

with v(cordage, controle, puissance, durabilite, note) as (values
  ('VS 69', 4, 3, 4, 'Cordage 0,69 mm au toucher doux, contrôle et longévité élevés. Un choix confortable et durable pour le jeu régulier.'),
  ('VS-63', 3, 5, 2, 'Cordage fin 0,63 mm : répulsion élevée et frappe nette, pour les joueurs qui privilégient la vitesse. Durabilité limitée.')
),
upd as (
  update public.cordages c
     set info_controle = v.controle, info_puissance = v.puissance,
         info_durabilite = v.durabilite, info_note = v.note
    from v
   where c.cordage = v.cordage
     and c.info_controle is null and c.info_puissance is null
     and c.info_durabilite is null and c.info_note is null
  returning c.cordage
)
select (select string_agg(cordage, ', ') from upd) as cordages_remplis;
