import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { formatCurrency, formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const client = await prisma.client.findUnique({
    where: { id, deletedAt: null },
    include: {
      contacts: true,
      projects: {
        where: {
          deletedAt: null,
          ...(scope.projectIds === null ? {} : { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } }),
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
      invoices: {
        where:
          scope.projectIds === null
            ? {}
            : { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
        orderBy: { dueDate: "desc" },
        take: 20,
      },
      documents: {
        where:
          scope.projectIds === null
            ? {}
            : {
                OR: [
                  { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
                  { projectId: null, clientId: id },
                ],
              },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!client) notFound();
  if (scope.projectIds !== null && client.projects.length === 0) notFound();

  const outstanding = client.invoices.reduce((acc, item) => acc + (Number(item.totalAmount) - Number(item.paidAmount)), 0);

  return (
    <PermissionGuard resource="PROJECTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title={client.name}
          subtitle={`${client.cui || "Fara CUI"} • ${client.email || "fara email"} • ${client.phone || "fara telefon"}`}
          actions={<Link href="/clienti" className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-sm">Inapoi la clienti</Link>}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <p className="text-xs text-[#9fb2cd]">Proiecte active</p>
            <p className="mt-2 text-2xl font-semibold text-[#edf4ff]">{client.projects.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[#9fb2cd]">Facturi totale</p>
            <p className="mt-2 text-2xl font-semibold text-[#edf4ff]">{client.invoices.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[#9fb2cd]">Rest de incasat</p>
            <p className="mt-2 text-2xl font-semibold text-[#edf4ff]">{formatCurrency(outstanding)}</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <h2 className="text-lg font-semibold text-[#edf4ff]">Date generale</h2>
            <div className="mt-3 space-y-1 text-sm text-[#d8e5f8]">
              <p><span className="text-[#9fb2cd]">Tip:</span> {client.type}</p>
              <p><span className="text-[#9fb2cd]">CUI:</span> {client.cui || "-"}</p>
              <p><span className="text-[#9fb2cd]">Nr. inreg.:</span> {client.registrationNumber || "-"}</p>
              <p><span className="text-[#9fb2cd]">Adresa facturare:</span> {client.billingAddress || "-"}</p>
              <p><span className="text-[#9fb2cd]">Note:</span> {client.notes || "-"}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#edf4ff]">Contacte</h2>
            <div className="mt-3 space-y-2">
              {client.contacts.map((contact) => (
                <div key={contact.id} className="rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)] p-3 text-sm">
                  <p className="font-semibold text-[#edf4ff]">{contact.fullName}</p>
                  <p className="text-xs text-[#9fb2cd]">{contact.roleTitle || "-"} • {contact.email || "-"} • {contact.phone || "-"}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#edf4ff]">Documente</h2>
            <div className="mt-3 space-y-2">
              {client.documents.map((doc) => (
                <a key={doc.id} href={doc.storagePath} target="_blank" className="block rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)] p-3 text-sm hover:border-[#3b639d]">
                  <p className="font-semibold text-[#edf4ff]">{doc.title}</p>
                  <p className="text-xs text-[#9fb2cd]">{doc.category} • {doc.fileName}</p>
                </a>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[#edf4ff]">Proiecte</h2>
            <div className="mt-3 space-y-2">
              {client.projects.map((project) => (
                <Link key={project.id} href={`/proiecte/${project.id}`} className="block rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)] p-3 text-sm hover:border-[#3b639d]">
                  <p className="font-semibold text-[#edf4ff]">{project.title}</p>
                  <p className="text-xs text-[#9fb2cd]">{project.code} • {project.status} • Progres {project.progressPercent}%</p>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#edf4ff]">Facturi</h2>
            <div className="mt-3 space-y-2">
              {client.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)] p-3 text-sm">
                  <p className="font-semibold text-[#edf4ff]">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-[#9fb2cd]">{formatDate(invoice.issueDate)} • Scadenta {formatDate(invoice.dueDate)} • {invoice.status}</p>
                  <p className="text-xs text-[#9fb2cd]">Total {formatCurrency(invoice.totalAmount.toString())} • Achitat {formatCurrency(invoice.paidAmount.toString())}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
