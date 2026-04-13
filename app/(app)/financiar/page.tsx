import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { formatCurrency } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { updateInvoiceStatus } from "./actions";
import { CostEntryForm } from "./cost-entry-form";

export default async function FinanciarPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: InvoiceStatus; projectId?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || "1"));
  const pageSize = 15;
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const scopedProjectFilter = scope.projectIds === null ? undefined : { in: scope.projectIds.length ? scope.projectIds : ["__none__"] };
  const invoiceWhere = {
    status: params.status || undefined,
    ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter! }),
    ...(params.projectId
      ? { projectId: scope.projectIds === null || scope.projectIds.includes(params.projectId) ? params.projectId : "__none__" }
      : {}),
  };

  const [invoices, totalInvoices, costs, projects] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,
      include: { project: true, client: true },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where: invoiceWhere }),
    prisma.costEntry.groupBy({
      by: ["type"],
      where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter! },
      _sum: { amount: true },
    }),
    prisma.project.findMany({
      where: { deletedAt: null, ...(scope.projectIds === null ? {} : { id: scopedProjectFilter! }) },
      include: { costs: true, invoices: true },
      take: 25,
      orderBy: { title: "asc" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));

  return (
    <PermissionGuard resource="INVOICES" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Financiar operational" subtitle="Buget proiect, costuri reale, TVA, creante, status facturi, marja estimata" />
        <div className="flex justify-end">
          <Link href="/api/export/financiar">
            <Button variant="secondary">Export CSV Financiar</Button>
          </Link>
        </div>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {costs.map((cost) => (
            <Card key={cost.type}>
              <p className="text-xs uppercase tracking-wide text-[#9fb3ce]">Cost {cost.type}</p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(cost._sum.amount?.toString() || 0)}</p>
            </Card>
          ))}
        </section>

        <Card>
          <h2 className="text-lg font-semibold text-[#eef4ff]">Adauga cost operational</h2>
          <CostEntryForm projects={projects.map((project) => ({ id: project.id, label: project.title }))} />
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[#eef4ff]">Facturi si incasari</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="page" value="1" />
            <select name="status" defaultValue={params.status || ""}>
              <option value="">Toate statusurile</option>
              {Object.values(InvoiceStatus).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select name="projectId" defaultValue={params.projectId || ""}>
              <option value="">Toate proiectele</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Filtreaza</Button>
          </form>
          <div className="mt-3 space-y-2">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-xl border border-[color:var(--border)] bg-[rgba(12,21,38,0.88)] p-3 text-sm text-[#dee8f8]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{invoice.invoiceNumber} • {invoice.project.title} • {invoice.client.name}</span>
                  <span className="font-semibold text-[#edf4ff]">{formatCurrency(invoice.totalAmount.toString())}</span>
                  <Badge tone={invoice.status === "OVERDUE" ? "danger" : invoice.status === "PAID" ? "success" : "warning"}>{invoice.status}</Badge>
                </div>
                <form action={updateInvoiceStatus} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="id" value={invoice.id} />
                  <select name="status" defaultValue={invoice.status} className="h-9 w-auto min-w-[180px] rounded-md px-2 text-xs">
                    {Object.values(InvoiceStatus).map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="secondary">Actualizeaza status</Button>
                </form>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-[#9fb3ce]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link href={`/financiar?page=${page - 1}&status=${params.status || ""}&projectId=${params.projectId || ""}`} className="rounded-md border border-[var(--border)] px-3 py-1">Anterior</Link> : null}
              {page < totalPages ? <Link href={`/financiar?page=${page + 1}&status=${params.status || ""}&projectId=${params.projectId || ""}`} className="rounded-md border border-[var(--border)] px-3 py-1">Urmator</Link> : null}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[#eef4ff]">Cashflow si marja estimata pe proiect</h2>
          <div className="mt-3 space-y-2">
            {projects.map((project) => {
              const costTotal = project.costs.reduce((sum, item) => sum + Number(item.amount), 0);
              const invoiced = project.invoices.reduce((sum, item) => sum + Number(item.totalAmount), 0);
              const margin = invoiced - costTotal;
              return (
                <div key={project.id} className="rounded-xl border border-[color:var(--border)] bg-[rgba(12,21,38,0.78)] p-3 text-sm text-[#dde8f8]">
                  <p className="font-semibold text-[#edf4ff]">{project.title}</p>
                  <p className="text-xs text-[#9fb3ce]">Cost: {formatCurrency(costTotal)} • Facturat: {formatCurrency(invoiced)} • Marja: {formatCurrency(margin)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
