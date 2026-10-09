-- ════════════════════════════════════════════════════════════════════════════
-- Remplissage des infos cordage (bouton « i »)
-- • source « stringflow » : notes et textes repris de Stringflow (même cordage)
-- • source « estimation » : modèle absent de Stringflow, estimé sur la même
--   échelle (0-5) — modifiable ensuite dans la page Cordages
-- Ne remplit QUE les cordages encore sans aucune info (rien n'est écrasé).
-- Non remplis (références incertaines) : Victor VS 69, VS-53, VS-63.
-- SQL Editor. Relançable.
-- ════════════════════════════════════════════════════════════════════════════

with v(cordage, controle, puissance, durabilite, note, source) as (values
  -- ── Repris de Stringflow ──────────────────────────────────────────────────
  ('Li Ning n°1', 4, 5, 2, 'La référence premium Li-Ning, ultra-fin, très explosif, sensations exceptionnelles. Endurance limitée, pour les joueurs exigeants.', 'stringflow'),
  ('VBS 58',      2, 5, 1, 'Le plus fin de Victor, répulsion extrême pour les attaquants purs. Durée de vie très courte, uniquement pour joueurs expérimentés.', 'stringflow'),
  ('VBS 66',      4, 3, 3, 'Cordage polyvalent et équilibré, bon toucher volant. Référence chez Victor, s''adapte à tous les profils.', 'stringflow'),
  ('VBS 68',      3, 4, 4, 'Puissance et durabilité chez Victor. Bon répondant pour les joueurs physiques qui ne veulent pas sacrifier la longévité.', 'stringflow'),
  ('VBS 70',      3, 3, 5, 'Le plus durable de Victor, robuste et fiable, parfait pour les débutants ou les joueurs qui cassent fréquemment.', 'stringflow'),
  ('Aeroboost',   4, 4, 3, 'Surface texturée pour plus d''adhérence sur le volant. Placement précis et effet amélioré, idéal pour les joueurs subtils. Hybride.', 'stringflow'),
  ('BG 65',       3, 3, 5, 'Polyvalent et fiable, idéal du débutant à l''intermédiaire. Rarement décevant. Cordage le plus vendu au monde.', 'stringflow'),
  ('BG 65 Ti',    3, 3, 4, 'Version titane du BG 65 légèrement plus rigide et résistante. Même polyvalence, durée de vie légèrement accrue.', 'stringflow'),
  ('BG 66 U',     4, 4, 1, 'Fin et dynamique, excellent toucher volant. Sensation excellente mais faible durabilité.', 'stringflow'),
  ('BG 80',       5, 3, 3, 'Référence pour le contrôle et la précision à haute tension. Favori des joueurs techniques. Rugueux.', 'stringflow'),
  ('BG 80 Power', 4, 4, 3, 'Déclinaison puissance du BG 80 : réactivité accrue tout en conservant une bonne précision. Excellent pour le jeu complet.', 'stringflow'),
  ('Exbolt 63',   3, 5, 2, 'Ultra-fin et explosif, répulsion maximale pour les smasheurs. Fragile, à réserver aux joueurs confirmés qui acceptent de recorder souvent.', 'stringflow'),
  ('Exbolt 65',   4, 4, 3, 'Excellent équilibre puissance/contrôle. Le successeur moderne et dynamique du BG 66 Ultimax, une valeur sûre.', 'stringflow'),
  ('Exbolt 68',   5, 3, 4, 'Le plus précis et durable de la gamme Exbolt. Idéal à haute tension pour un jeu technique, chirurgical et constant.', 'stringflow'),
  -- ── Estimations (même échelle) ────────────────────────────────────────────
  ('I-Feel 70',   4, 3, 4, 'Cordage épais et durable de Babolat, bon contrôle et toucher confortable. Un choix fiable pour le jeu régulier.', 'estimation'),
  ('KSB 68',      3, 3, 4, 'Cordage économique et résistant, sensations correctes et bonne tenue de tension. Adapté au jeu loisir et club.', 'estimation'),
  ('VBS 63',      3, 5, 2, 'Fin et très réactif, belle répulsion et son de frappe net. Pour les attaquants qui acceptent une durée de vie réduite.', 'estimation'),
  ('Aerobite',    4, 4, 2, 'Cordage hybride à surface texturée : accroche du volant et effets de coupe excellents. Sensations premium, durabilité moyenne.', 'estimation'),
  ('Aerosonic',   3, 5, 1, 'Le plus fin de chez Yonex : répulsion et son de frappe exceptionnels. Très fragile, pour joueurs confirmés.', 'estimation'),
  ('BG 3',        3, 2, 5, 'Cordage robuste d''entrée de gamme, très bonne durabilité. Parfait pour débuter ou pour les joueurs qui cassent souvent.', 'estimation'),
  ('BG 66 Force', 3, 4, 3, 'Version renforcée du BG 66 : répulsion et son de frappe dynamiques avec une meilleure tenue dans le temps.', 'estimation'),
  ('NGY 95',      4, 3, 4, 'Bonne tenue de tension et contrôle précis, toucher doux. Très bon compromis pour le joueur régulier.', 'estimation'),
  ('NGY 98',      3, 5, 3, 'Répulsion élevée et son de frappe sec, idéal pour les smashs. Meilleure longévité que la plupart des cordages fins.', 'estimation')
),
upd as (
  update public.cordages c
     set info_controle = v.controle, info_puissance = v.puissance,
         info_durabilite = v.durabilite, info_note = v.note
    from v
   where c.cordage = v.cordage
     and c.info_controle is null and c.info_puissance is null
     and c.info_durabilite is null and c.info_note is null
  returning c.cordage, v.source
)
select
  (select count(*) from upd)                                as cordages_remplis,
  (select count(*) from upd where source = 'stringflow')    as dont_stringflow,
  (select count(*) from upd where source = 'estimation')    as dont_estimation,
  (select string_agg(v.cordage, ', ') from v
    where not exists (select 1 from public.cordages c where c.cordage = v.cordage)) as noms_introuvables,
  (select string_agg(cordage, ', ' order by cordage) from public.cordages
    where info_controle is null and info_note is null
      and cordage not in (select cordage from upd))         as restent_sans_infos;
