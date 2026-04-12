import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";

export default function SetariPage() {
  return (
    <PermissionGuard resource="SETTINGS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Setari platforma" subtitle="Utilizatori, roluri, permisiuni, fluxuri aprobari, integrare email/e-Factura" />
        <Card>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#425448]">
            <li>Gestionare utilizatori si roluri cu permisiuni granulare pe module.</li>
            <li>Configurare notificari in-app si arhitectura pentru email.</li>
            <li>Configurare reguli de aprobare pontaj si cereri materiale.</li>
            <li>Setari export contabilitate si placeholder integrare e-Factura.</li>
          </ul>
        </Card>
      </div>
    </PermissionGuard>
  );
}
