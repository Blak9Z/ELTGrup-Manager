import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { prisma } from "@/src/lib/prisma";

export default async function AnaliticePage() {
  const [hoursByProject, materialUsage, delayedWorks, equipmentUtilization] = await Promise.all([
    prisma.timeEntry.groupBy({ by: ["projectId"], _sum: { durationMinutes: true }, orderBy: { _sum: { durationMinutes: "desc" } }, take: 10 }),
    prisma.projectMaterialUsage.groupBy({
      by: ["projectId"],
      _sum: { quantityUsed: true },
      orderBy: { _sum: { quantityUsed: "desc" } },
      take: 10,
    }),
    prisma.workOrder.count({ where: { dueDate: { lt: new Date() }, status: { notIn: ["DONE", "CANCELED"] } } }),
    prisma.equipmentAssignment.groupBy({
      by: ["equipmentId"],
      _sum: { usageHours: true },
      orderBy: { _sum: { usageHours: "desc" } },
      take: 10,
    }),
  ]);

  return (
    <PermissionGuard resource="REPORTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Rapoarte si analitice" subtitle="Productivitate, consum materiale, intarzieri, utilizare echipamente, profitabilitate" />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#5f7265]">Proiecte monitorizate</p>
            <p className="mt-2 text-2xl font-black">{hoursByProject.length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#5f7265]">Consum materiale proiecte</p>
            <p className="mt-2 text-2xl font-black">{materialUsage.length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#5f7265]">Lucrari intarziate</p>
            <p className="mt-2 text-2xl font-black">{delayedWorks}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-[#5f7265]">Utilizare echipamente</p>
            <p className="mt-2 text-2xl font-black">{equipmentUtilization.length}</p>
          </Card>
        </section>

        <Card>
          <p className="text-sm text-[#5f7265]">Exporturi disponibile in format PDF/Excel se pot extinde pe endpointuri dedicate. Modulul este pregatit pentru integrare e-Factura.</p>
        </Card>
      </div>
    </PermissionGuard>
  );
}
