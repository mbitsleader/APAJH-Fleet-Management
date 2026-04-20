import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 lg:p-24">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-xl md:p-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          ← Retour au tableau de bord
        </Link>
        
        <h1 className="mb-8 text-4xl font-black text-slate-900">Politique de Confidentialité</h1>
        
        <div className="prose prose-slate max-w-none space-y-6 text-slate-600">
          <section>
            <h2 className="text-xl font-bold text-slate-800">1. Collecte des données</h2>
            <p>
              Dans le cadre de la gestion de la flotte automobile de l'APAJH Mayotte, nous collectons les données suivantes :
            </p>
            <ul className="list-disc pl-5">
              <li>Nom et Prénom</li>
              <li>Adresse email professionnelle</li>
              <li>Historique des réservations et des trajets (kilométrage, destination, notes professionnelles)</li>
              <li>Logs de nettoyage et de carburant</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">2. Finalité du traitement</h2>
            <p>
              Les données sont collectées pour assurer le suivi technique des véhicules, la sécurité des conducteurs et l'organisation des déplacements professionnels. Elles ne sont en aucun cas utilisées à des fins commerciales ou transmises à des tiers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">3. Durée de conservation</h2>
            <p>
              Les données sont conservées pendant une durée de 5 ans après la fin de l'utilisation du service, conformément aux obligations légales de traçabilité et de comptabilité. Les comptes utilisateurs supprimés sont anonymisés ou archivés de manière sécurisée (Soft Delete).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800">4. Vos droits</h2>
            <p>
              Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits, vous pouvez contacter l'administrateur du système ou le DPO de l'association.
            </p>
          </section>

          <section className="rounded-xl bg-slate-100 p-6 italic">
            <p className="text-sm">
              Dernière mise à jour : 27 Mars 2026. Cette application est un outil professionnel interne à l'APAJH Mayotte.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
