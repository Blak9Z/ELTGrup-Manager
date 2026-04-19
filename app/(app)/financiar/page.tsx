import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { parseEnumParam, parsePositiveIntParam } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { formatCurrency } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { updateInvoiceStatus } from "./actions";
import { CostEntryForm } from "./cost-entry-form";

export default async function FinanciarPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; projectId?: string }>;
}) {
  const params = await searchParams;
  const page = parsePositiveIntParam(params.page);
  const statusFilter = parseEnumParam(params.status, Object.values(InvoiceStatus));
  const pageSize = 15;
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const roleKeys = session?.user?.roleKeys || [];
  const userEmail = session?.user?.email || null;
  const canCreateCost = hasPermission(roleKeys, "INVOICES", "CREATE", userEmail);
  const canUpdateInvoice = hasPermission(roleKeys, "INVOICES", "UPDATE", userEmail);
  const canExportInvoices = hasPermission(roleKeys, "INVOICES", "EXPORT", userEmail);
  const scopedProjectFilter = scope.projectIds === null ? undefined : { in: scope.projectIds.length ? scope.projectIds : ["__none__"] };
  const invoiceWhere = {
    status: statusFilter,
    ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter! }),
    ...(params.projectId
      ? { projectId: scope.projectIds === null || scope.projectIds.includes(params.projectId) ? params.projectId : "__none__" }
      : {}),
  };

  const [invoices, totalInvoices, costs, projects] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        project: { select: { id: true, title: true } },
        client: { select: { name: true } },
      },
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
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);
  const [projectCostSums, projectInvoiceSums] = await Promise.all([
    prisma.costEntry.groupBy({
      by: ["projectId"],
      where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter! },
      _sum: { amount: true },
    }),
    prisma.invoice.groupBy({
      by: ["projectId"],
      where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter! },
      _sum: { totalAmount: true },
    }),
  ]);
  const costByProject = new Map(projectCostSums.map((item) => [item.projectId, Number(item._sum.amount || 0)]));
  const invoicedByProject = new Map(projectInvoiceSums.map((item) => [item.projectId, Number(item._sum.totalAmount || 0)]));
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));

  return (
    <PermissionGuard resource="INVOICES" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Financiar operational" subtitle="Buget proiect, costuri reale, TVA, creante, status facturi, marja estimata" />
        {canExportInvoices ? (
          <div className="flex justify-end">
            <Link href="/api/export/financiar">
              <Button variant="secondary">Export CSV Financiar</Button>
            </Link>
          </div>
        ) : null}
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {costs.length === 0 ? (
            <Card className="md:col-span-2 xl:col-span-4">
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Costuri</p>
              <p className="mt-2 text-sm text-[var(--muted)]">Nu exista costuri inregistrate in aria ta pentru filtrul curent.</p>
            </Card>
          ) : null}
          {costs.map((cost) => (
            <Card key={cost.type}>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Cost {cost.type}</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{formatCurrency(cost._sum.amount?.toString() || 0)}</p>
            </Card>
          ))}
        </section>

        {canCreateCost ? (
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Costs</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Adauga cost operational</h2>
            <CostEntryForm projects={projects.map((project) => ({ id: project.id, label: project.title }))} />
          </Card>
        ) : null}

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Invoices</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Facturi si incasari</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="page" value="1" />
            <select name="status" defaultValue={statusFilter || ""}>
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
          {invoices.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Nu exista facturi pentru filtrele curente.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm text-[#dee8f8]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{invoice.invoiceNumber} • {invoice.project.title} • {invoice.client.name}</span>
                    <span className="font-semibold text-[var(--foreground)]">{formatCurrency(invoice.totalAmount.toString())}</span>
                    <Badge tone={invoice.status === "OVERDUE" ? "danger" : invoice.status === "PAID" ? "success" : "warning"}>{invoice.status}</Badge>
                  </div>
                  {canUpdateInvoice ? (
                    <form action={updateInvoiceStatus} className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,220px)_auto] sm:items-center">
                      <input type="hidden" name="id" value={invoice.id} />
                      <select name="status" defaultValue={invoice.status} className="h-9 w-full rounded-md px-2 text-xs">
                        {Object.values(InvoiceStatus).map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="secondary" className="w-full sm:w-auto">Actualizeaza status</Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link href={`/financiar?page=${page - 1}&status=${statusFilter || ""}&projectId=${params.projectId || ""}`} className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--border-strong)]">Anterior</Link> : null}
              {page < totalPages ? <Link href={`/financiar?page=${page + 1}&status=${statusFilter || ""}&projectId=${params.projectId || ""}`} className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--border-strong)]">Urmator</Link> : null}
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Margins</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Cashflow si marja estimata pe proiect</h2>
          <div className="mt-3 space-y-2">
            {projects.length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                Nu exista proiecte in aria ta pentru calculul de marja.
              </p>
            ) : null}
            {projects.map((project) => {
              const costTotal = costByProject.get(project.id) || 0;
              const invoiced = invoicedByProject.get(project.id) || 0;
              const margin = invoiced - costTotal;
              return (
                <div key={project.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm text-[#dde8f8]">
                  <p className="font-semibold text-[var(--foreground)]">{project.title}</p>
                  <p className="text-xs text-[var(--muted)]">Cost: {formatCurrency(costTotal)} • Facturat: {formatCurrency(invoiced)} • Marja: {formatCurrency(margin)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
