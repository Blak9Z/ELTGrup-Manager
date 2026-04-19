import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope, subcontractorScopeWhere } from "@/src/lib/access-scope";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";
import { updateSubcontractorAction, updateSubcontractorStatus } from "./actions";
import { SubcontractorCreateForm } from "./subcontractor-create-form";

export default async function SubcontractoriPage() {
  const session = await auth();
  const userContext = {
    id: session?.user?.id || "",
    email: session?.user?.email || null,
    roleKeys: session?.user?.roleKeys || [],
  };
  const canCreate = hasPermission(userContext.roleKeys, "TASKS", "CREATE", userContext.email);
  const canUpdate = hasPermission(userContext.roleKeys, "TASKS", "UPDATE", userContext.email);
  const scope = session?.user
    ? await resolveAccessScope(userContext)
    : { projectIds: null, teamId: null };
  const subcontractors = await prisma.subcontractor.findMany({
    where: { deletedAt: null, ...subcontractorScopeWhere(scope) },
    include: {
      assignments: {
        where:
          scope.projectIds === null
            ? {}
            : { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Subcontractori" subtitle="Vendor management: conformitate, date comerciale, status aprobare si alocari active pe proiecte." />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Companii active</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{subcontractors.length}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Aprobate</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{subcontractors.filter((c) => c.approvalStatus === "APROBAT").length}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">In verificare</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{subcontractors.filter((c) => c.approvalStatus === "IN_VERIFICARE").length}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Alocari active</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{subcontractors.reduce((acc, company) => acc + company.assignments.length, 0)}</p>
          </Card>
        </section>

        {canCreate ? (
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Create</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Adauga subcontractor</h2>
            <SubcontractorCreateForm />
          </Card>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {subcontractors.map((company) => (
            <Card key={company.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--foreground)]">{company.name}</p>
                <Badge tone={company.approvalStatus === "APROBAT" ? "success" : "warning"}>{company.approvalStatus}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                <p>Contact: {company.contactName || "-"}</p>
                <p>Email: {company.email || "-"}</p>
                <p className="col-span-2">Alocari active: {company.assignments.length}</p>
              </div>

              {canUpdate ? (
                <>
                  <form action={updateSubcontractorAction} className="mt-3 grid gap-2">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Date comerciale</p>
                    <input type="hidden" name="id" value={company.id} />
                    <Input name="name" defaultValue={company.name} />
                    <Input name="cui" defaultValue={company.cui || ""} />
                    <Input name="contactName" defaultValue={company.contactName || ""} />
                    <Input name="email" defaultValue={company.email || ""} />
                    <Input name="phone" defaultValue={company.phone || ""} />
                    <Button type="submit" size="sm">Salveaza detalii</Button>
                  </form>

                  <form action={updateSubcontractorStatus} className="mt-3 flex items-center gap-2">
                    <input type="hidden" name="id" value={company.id} />
                    <select name="approvalStatus" defaultValue={company.approvalStatus} className="h-9 rounded-md border border-[var(--border)] px-2 text-xs">
                      {[
                        "IN_VERIFICARE",
                        "APROBAT",
                        "RESPINS",
                        "SUSPENDAT",
                      ].map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="secondary">Actualizeaza</Button>
                  </form>
                </>
              ) : (
                <p className="mt-3 text-xs text-[var(--muted)]">Doar utilizatorii cu drept de actualizare lucrari pot modifica subcontractorii.</p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}
