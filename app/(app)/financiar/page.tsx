import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormModal } from "@/src/components/forms/form-modal";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { buildListHref, parseEnumParam, parsePositiveIntParam, resolvePagination } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { formatCurrency } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { updateInvoiceStatus } from "./actions";
import { CostEntryForm } from "./cost-entry-form";

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Trimisa",
  PARTIAL_PAID: "Partial achitata",
  PAID: "Achitata",
  OVERDUE: "Restanta",
  CANCELED: "Anulata",
};

const invoiceWorkflowOrder: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIAL_PAID,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.PAID,
  InvoiceStatus.CANCELED,
];

function buildFinanciarHref({
  page,
  status,
  projectId,
}: {
  page?: number;
  status?: InvoiceStatus | null;
  projectId?: string;
}) {
  return buildListHref("/financiar", {
    page,
    status: status || undefined,
    projectId,
  });
}

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
  const invoiceScopeWhere = {
    ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter! }),
    ...(params.projectId
      ? { projectId: scope.projectIds === null || scope.projectIds.includes(params.projectId) ? params.projectId : "__none__" }
      : {}),
  };
  const invoiceWhere = {
    ...invoiceScopeWhere,
    status: statusFilter,
  };

  const [totalInvoices, costs, projects, invoiceStatusSummary] = await Promise.all([
    prisma.invoice.count({ where: invoiceWhere }),
    prisma.costEntry.groupBy({
      by: ["type"],
      where: scope.projectIds === null ? undefined : { projectId: scopedProjectFilter! },
      _sum: { amount: true },
    }),
    prisma.project.findMany({
      where: { deletedAt: null, ...(scope.projectIds === null ? {} : { id: scopedProjectFilter! }) },
      select: { id: true, title: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: invoiceScopeWhere,
      _count: { _all: true },
      _sum: { totalAmount: true, paidAmount: true },
    }),
  ]);
  const { totalPages, currentPage, skip, take } = resolvePagination({
    page,
    totalItems: totalInvoices,
    pageSize,
  });
  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      dueDate: true,
      issueDate: true,
      sentAt: true,
      paidAt: true,
      status: true,
      project: { select: { id: true, title: true } },
      client: { select: { name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    skip,
    take,
  });
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
  const statusSummaryMap = new Map(invoiceStatusSummary.map((item) => [item.status, item]));
  const outstandingAmount = invoiceStatusSummary
    .filter((item) => item.status !== InvoiceStatus.PAID && item.status !== InvoiceStatus.CANCELED)
    .reduce((sum, item) => sum + Number(item._sum.totalAmount || 0), 0);
  const paidAmount = invoiceStatusSummary
    .filter((item) => item.status === InvoiceStatus.PAID)
    .reduce((sum, item) => sum + Number(item._sum.paidAmount || 0), 0);

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
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Total facturi filtrate</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{totalInvoices}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">in registrul curent</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Valoare restanta</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{formatCurrency(outstandingAmount)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">facturi emise/restante neincasate</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Incasat</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{formatCurrency(paidAmount)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">facturi marcate PAID</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Workflow activ</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {invoiceWorkflowOrder.map((status) => {
                const count = statusSummaryMap.get(status)?._count._all || 0;
                return (
                  <Link
                    key={status}
                    href={buildFinanciarHref({
                      page: 1,
                      status,
                      projectId: params.projectId,
                    })}
                    className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]"
                  >
                    {invoiceStatusLabels[status]} ({count})
                  </Link>
                );
              })}
            </div>
          </Card>
        </section>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Costuri</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Adauga cost operational</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Introdu costurile din dialog pentru a mentine vizibilitatea asupra facturilor si marjelor.
            </p>
            <div className="mt-3">
              <FormModal
                triggerLabel="Adauga cost"
                title="Cost operational nou"
                description="Asociaza costul unui proiect si unei categorii."
              >
                <CostEntryForm projects={projects.map((project) => ({ id: project.id, label: project.title }))} />
              </FormModal>
            </div>
          </Card>
        ) : null}

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Facturi</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Facturi si incasari</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {"Flux recomandat: Draft -> Trimisa -> Partial achitata / Restanta -> Achitata."}
          </p>
          <form className="mt-3 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="page" value="1" />
            <select name="status" defaultValue={statusFilter || ""}>
              <option value="">Toate statusurile</option>
              {Object.values(InvoiceStatus).map((status) => (
                <option key={status} value={status}>{invoiceStatusLabels[status]}</option>
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
                    <Badge tone={invoice.status === "OVERDUE" ? "danger" : invoice.status === "PAID" ? "success" : "warning"}>
                      {invoiceStatusLabels[invoice.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Scadenta {new Intl.DateTimeFormat("ro-RO").format(invoice.dueDate)}
                    {invoice.issueDate ? ` • Emisa ${new Intl.DateTimeFormat("ro-RO").format(invoice.issueDate)}` : ""}
                    {invoice.sentAt ? ` • Trimisa ${new Intl.DateTimeFormat("ro-RO").format(invoice.sentAt)}` : ""}
                    {invoice.paidAt ? ` • Incasata ${new Intl.DateTimeFormat("ro-RO").format(invoice.paidAt)}` : ""}
                  </p>
                  {canUpdateInvoice ? (
                    <form action={updateInvoiceStatus} className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,220px)_auto] sm:items-center">
                      <input type="hidden" name="id" value={invoice.id} />
                      <select name="status" defaultValue={invoice.status} className="h-9 w-full rounded-md px-2 text-xs">
                        {Object.values(InvoiceStatus).map((status) => (
                          <option key={status} value={status}>{invoiceStatusLabels[status]}</option>
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
            <span>Pagina {currentPage} din {totalPages}</span>
            <div className="flex gap-2">
              {currentPage > 1 ? <Link href={buildFinanciarHref({ page: currentPage - 1, status: statusFilter, projectId: params.projectId })} className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--border-strong)]">Anterior</Link> : null}
              {currentPage < totalPages ? <Link href={buildFinanciarHref({ page: currentPage + 1, status: statusFilter, projectId: params.projectId })} className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--border-strong)]">Urmator</Link> : null}
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Marje</p>
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
