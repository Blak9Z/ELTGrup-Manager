import { EquipmentStatus } from "@prisma/client";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { equipmentScopeWhere, resolveAccessScope } from "@/src/lib/access-scope";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { updateEquipmentStatus } from "./actions";
import { EquipmentCreateForm } from "./equipment-create-form";

export default async function EchipamentePage() {
  const session = await auth();
  const userContext = {
    id: session?.user?.id || "",
    email: session?.user?.email || null,
    roleKeys: session?.user?.roleKeys || [],
  };
  const scope = session?.user
    ? await resolveAccessScope(userContext)
    : { projectIds: null, teamId: null };
  const equipments = await prisma.equipment.findMany({
    where: { deletedAt: null, ...equipmentScopeWhere(userContext, scope) },
    include: {
      assignments: {
        where:
          scope.projectIds === null
            ? {}
            : {
                OR: [
                  { assignedUserId: userContext.id },
                  { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
                ],
              },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <PermissionGuard resource="MATERIALS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Echipamente si active" subtitle="Status utilaje, alocare proiect, mentenanta, cod QR, utilizare" />

        <Card>
          <h2 className="text-lg font-extrabold">Adauga echipament</h2>
          <EquipmentCreateForm />
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {equipments.map((equipment) => (
            <Card key={equipment.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">{equipment.name}</p>
                <Badge tone={equipment.status === "AVAILABLE" ? "success" : equipment.status === "SERVICE" ? "warning" : "info"}>{equipment.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-[#9fb3ce]">Cod: {equipment.code} • SN: {equipment.serialNumber || "-"}</p>
              <p className="mt-1 text-xs text-[#9fb3ce]">Mentenanta: {equipment.maintenanceDueAt ? formatDate(equipment.maintenanceDueAt) : "-"}</p>
              <p className="mt-1 text-xs text-[#9fb3ce]">Alocari: {equipment.assignments.length}</p>
              <form action={updateEquipmentStatus} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="id" value={equipment.id} />
                <select name="status" defaultValue={equipment.status} className="h-9 rounded-md border border-[var(--border)] px-2 text-xs">
                  {Object.values(EquipmentStatus).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="secondary">Actualizeaza</Button>
              </form>
            </Card>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}
