// src/pages/MentionsLegales.jsx

export default function MentionsLegales() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-2xl border p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Mentions légales</h1>
          <p className="text-sm text-gray-400">Application Sportminedor — Suivi de cordage</p>
        </div>

        {/* Éditeur */}
        <Section title="1. Éditeur de l'application">
          <Row label="Dénomination" value="SPORTMINEDOR" />
          <Row label="Forme juridique" value="Société à responsabilité limitée (SARL)" />
          <Row label="SIRET" value="494 595 846 00051" />
          <Row label="N° TVA" value="FR84 494 595 846" />
          <Row label="Code APE" value="47.64Z — Commerce de détail d'articles de sport en magasin spécialisé" />
          <Row label="Adresse" value="22 Rue Louis Breguet, 34830 Jacou, France" />
          <Row label="Email" value="franck.dessaux@sportminedor.com" />
        </Section>

        {/* Hébergement */}
        <Section title="2. Hébergement">
          <Row label="Application" value="Vercel Inc. — 340 Pine Street, San Francisco, CA 94104, USA" />
          <Row label="Base de données" value="Supabase — région EU West (Irlande)" />
        </Section>

        {/* Données personnelles */}
        <Section title="3. Données personnelles & RGPD">
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            Dans le cadre de l'utilisation de cette application, les données personnelles suivantes sont collectées :
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mb-3">
            <li>Nom et prénom</li>
            <li>Numéro de téléphone</li>
            <li>Historique de cordage (raquettes, cordages, tensions)</li>
          </ul>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            Ces données sont collectées dans le seul but de gérer les prestations de cordage et d'assurer le suivi client. Elles ne sont ni vendues, ni transmises à des tiers.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            Les données sont conservées pendant une durée maximale de <strong>3 ans</strong> à compter du dernier contact.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679), vous disposez des droits suivants :
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mt-2 mb-3">
            <li>Droit d'accès à vos données</li>
            <li>Droit de rectification</li>
            <li>Droit à l'effacement (« droit à l'oubli »)</li>
            <li>Droit d'opposition au traitement</li>
          </ul>
          <p className="text-sm text-gray-600 leading-relaxed">
            Pour exercer ces droits, contactez : <a href="mailto:franck.dessaux@sportminedor.com" className="underline text-blue-600">franck.dessaux@sportminedor.com</a>
          </p>
        </Section>

        {/* Cookies */}
        <Section title="4. Cookies & stockage local">
          <p className="text-sm text-gray-600 leading-relaxed">
            Cette application utilise le stockage local du navigateur (<em>localStorage</em>) uniquement pour mémoriser vos préférences de navigation. Aucun cookie publicitaire ou traceur tiers n'est utilisé.
          </p>
        </Section>

        {/* Responsabilité */}
        <Section title="5. Limitation de responsabilité">
          <p className="text-sm text-gray-600 leading-relaxed">
            L'éditeur s'efforce d'assurer la disponibilité et l'exactitude des informations présentes dans l'application. Toutefois, il ne saurait être tenu responsable des interruptions de service, pertes de données ou dommages indirects liés à l'utilisation de l'application.
          </p>
        </Section>

        {/* Contact */}
        <Section title="6. Contact">
          <p className="text-sm text-gray-600">
            Pour toute question relative à ces mentions légales :{" "}
            <a href="mailto:franck.dessaux@sportminedor.com" className="underline text-blue-600">
              franck.dessaux@sportminedor.com
            </a>
          </p>
        </Section>

        <p className="text-xs text-gray-400 text-center pb-4">
          Dernière mise à jour : mars 2026
        </p>

      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide sm:w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  );
}