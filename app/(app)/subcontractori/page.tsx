import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { prisma } from "@/src/lib/prisma";
import { updateSubcontractorStatus } from "./actions";
import { SubcontractorCreateForm } from "./subcontractor-create-form";

export default async function SubcontractoriPage() {
  const subcontractors = await prisma.subcontractor.findMany({ include: { assignments: true }, orderBy: { updatedAt: "desc" } });

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Subcontractori" subtitle="Profile firme, conformitate, contracte, alocari si evaluare performanta" />

        <Card>
          <h2 className="text-lg font-extrabold">Adauga subcontractor</h2>
          <SubcontractorCreateForm />
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {subcontractors.map((company) => (
            <Card key={company.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">{company.name}</p>
                <Badge tone={company.approvalStatus === "APROBAT" ? "success" : "warning"}>{company.approvalStatus}</Badge>
              </div>
              <p className="mt-1 text-xs text-[#607368]">Contact: {company.contactName || "-"}</p>
              <p className="mt-1 text-xs text-[#607368]">Email: {company.email || "-"}</p>
              <p className="mt-1 text-xs text-[#607368]">Alocari active: {company.assignments.length}</p>

              <form action={updateSubcontractorStatus} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="id" value={company.id} />
                <select name="approvalStatus" defaultValue={company.approvalStatus} className="h-9 rounded-md border border-[#cfddd3] px-2 text-xs">
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
            </Card>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}
