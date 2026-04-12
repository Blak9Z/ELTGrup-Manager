import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
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
  const invoiceWhere = {
    status: params.status || undefined,
    projectId: params.projectId || undefined,
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
    prisma.costEntry.groupBy({ by: ["type"], _sum: { amount: true } }),
    prisma.project.findMany({ where: { deletedAt: null }, include: { costs: true, invoices: true }, take: 25, orderBy: { title: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));

  return (
    <PermissionGuard resource="INVOICES" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Financiar operational" subtitle="Buget proiect, costuri reale, TVA, creante, status facturi, marja estimata" />
        <div className="flex justify-end">
          <Link href="/api/export/financiar">
            <button className="h-10 rounded-lg border border-[#cfddd3] bg-white px-3 text-sm font-semibold text-[#2d4335]">Export Excel Financiar</button>
          </Link>
        </div>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {costs.map((cost) => (
            <Card key={cost.type}>
              <p className="text-xs uppercase tracking-wide text-[#5f7265]">Cost {cost.type}</p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(cost._sum.amount?.toString() || 0)}</p>
            </Card>
          ))}
        </section>

        <Card>
          <h2 className="text-lg font-extrabold">Adauga cost operational</h2>
          <CostEntryForm projects={projects.map((project) => ({ id: project.id, label: project.title }))} />
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold">Facturi si incasari</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="page" value="1" />
            <select name="status" defaultValue={params.status || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
              <option value="">Toate statusurile</option>
              {Object.values(InvoiceStatus).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select name="projectId" defaultValue={params.projectId || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
              <option value="">Toate proiectele</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg border border-[#cfddd3] bg-white px-3 text-sm font-semibold text-[#2d4335]">Filtreaza</button>
          </form>
          <div className="mt-3 space-y-2">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-lg border border-[#dbe8df] bg-[#f7fbf9] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{invoice.invoiceNumber} • {invoice.project.title} • {invoice.client.name}</span>
                  <span>{formatCurrency(invoice.totalAmount.toString())}</span>
                  <Badge tone={invoice.status === "OVERDUE" ? "danger" : invoice.status === "PAID" ? "success" : "warning"}>{invoice.status}</Badge>
                </div>
                <form action={updateInvoiceStatus} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="id" value={invoice.id} />
                  <select name="status" defaultValue={invoice.status} className="h-9 rounded-md border border-[#cfddd3] px-2 text-xs">
                    {Object.values(InvoiceStatus).map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <button type="submit" className="h-9 rounded-md border border-[#cfddd3] bg-white px-3 text-xs font-semibold">Actualizeaza status</button>
                </form>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-[#5f7265]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link href={`/financiar?page=${page - 1}&status=${params.status || ""}&projectId=${params.projectId || ""}`} className="rounded-md border border-[#cfdcd2] px-3 py-1">Anterior</Link> : null}
              {page < totalPages ? <Link href={`/financiar?page=${page + 1}&status=${params.status || ""}&projectId=${params.projectId || ""}`} className="rounded-md border border-[#cfdcd2] px-3 py-1">Urmator</Link> : null}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold">Cashflow si marja estimata pe proiect</h2>
          <div className="mt-3 space-y-2">
            {projects.map((project) => {
              const costTotal = project.costs.reduce((sum, item) => sum + Number(item.amount), 0);
              const invoiced = project.invoices.reduce((sum, item) => sum + Number(item.totalAmount), 0);
              const margin = invoiced - costTotal;
              return (
                <div key={project.id} className="rounded-lg border border-[#deebe2] p-3 text-sm">
                  <p className="font-semibold">{project.title}</p>
                  <p className="text-xs text-[#5f7265]">Cost: {formatCurrency(costTotal)} • Facturat: {formatCurrency(invoiced)} • Marja: {formatCurrency(margin)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
