import { EquipmentStatus } from "@prisma/client";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { equipmentScopeWhere, resolveAccessScope } from "@/src/lib/access-scope";
import { hasPermission } from "@/src/lib/rbac";
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
  const canCreate = hasPermission(userContext.roleKeys, "MATERIALS", "CREATE", userContext.email);
  const canUpdate = hasPermission(userContext.roleKeys, "MATERIALS", "UPDATE", userContext.email);
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
        <PageHeader title="Echipamente si active" subtitle="Asset control: status operational, mentenanta programata, alocari pe proiect si disponibilitate in teren." />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Total active</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{equipments.length}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Disponibile</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{equipments.filter((e) => e.status === "AVAILABLE").length}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">In utilizare</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{equipments.filter((e) => e.status === "IN_USE").length}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Service</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{equipments.filter((e) => e.status === "SERVICE").length}</p>
          </Card>
        </section>

        {canCreate ? (
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Create</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Adauga echipament</h2>
            <EquipmentCreateForm />
          </Card>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {equipments.map((equipment) => (
            <Card key={equipment.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--foreground)]">{equipment.name}</p>
                <Badge tone={equipment.status === "AVAILABLE" ? "success" : equipment.status === "SERVICE" ? "warning" : "info"}>{equipment.status}</Badge>
              </div>
              <div className="grid gap-1 text-xs text-[var(--muted)]">
                <p>Cod: {equipment.code} • SN: {equipment.serialNumber || "-"}</p>
                <p>Mentenanta: {equipment.maintenanceDueAt ? formatDate(equipment.maintenanceDueAt) : "-"}</p>
                <p>Alocari active: {equipment.assignments.length}</p>
              </div>
              {canUpdate ? (
                <form action={updateEquipmentStatus} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="id" value={equipment.id} />
                  <select name="status" defaultValue={equipment.status} className="h-9 rounded-md border border-[var(--border)] px-2 text-xs">
                    {Object.values(EquipmentStatus).map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="secondary">Actualizeaza</Button>
                </form>
              ) : (
                <p className="mt-3 text-xs text-[var(--muted)]">Doar utilizatorii cu drept de actualizare materiale pot modifica statusul.</p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}
