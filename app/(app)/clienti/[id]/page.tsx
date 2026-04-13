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
          actions={<Link href="/clienti" className="rounded-xl border border-[var(--border)] bg-[#152538] px-3 py-1.5 text-sm font-semibold text-[#d8e6fb] hover:border-[#4f6d8f]">Inapoi la clienti</Link>}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Proiecte active</p>
            <p className="mt-2 text-2xl font-semibold text-[#f2f9ff]">{client.projects.length}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Facturi totale</p>
            <p className="mt-2 text-2xl font-semibold text-[#f2f9ff]">{client.invoices.length}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#9fb1c5]">Rest de incasat</p>
            <p className="mt-2 text-2xl font-semibold text-[#f2f9ff]">{formatCurrency(outstanding)}</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Date generale</h2>
            <div className="mt-3 space-y-1 text-sm text-[#d8e5f8]">
              <p><span className="text-[#9fb1c5]">Tip:</span> {client.type}</p>
              <p><span className="text-[#9fb1c5]">CUI:</span> {client.cui || "-"}</p>
              <p><span className="text-[#9fb1c5]">Nr. inreg.:</span> {client.registrationNumber || "-"}</p>
              <p><span className="text-[#9fb1c5]">Adresa facturare:</span> {client.billingAddress || "-"}</p>
              <p><span className="text-[#9fb1c5]">Note:</span> {client.notes || "-"}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Contacte</h2>
            <div className="mt-3 space-y-2">
              {client.contacts.map((contact) => (
                <div key={contact.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm">
                  <p className="font-semibold text-[#f2f9ff]">{contact.fullName}</p>
                  <p className="text-xs text-[#9fb1c5]">{contact.roleTitle || "-"} • {contact.email || "-"} • {contact.phone || "-"}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Documente</h2>
            <div className="mt-3 space-y-2">
              {client.documents.map((doc) => (
                <a key={doc.id} href={doc.storagePath} target="_blank" rel="noreferrer noopener" className="block rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm hover:border-[#4f6d8f]">
                  <p className="font-semibold text-[#f2f9ff]">{doc.title}</p>
                  <p className="text-xs text-[#9fb1c5]">{doc.category} • {doc.fileName}</p>
                </a>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Proiecte</h2>
            <div className="mt-3 space-y-2">
              {client.projects.map((project) => (
                <Link key={project.id} href={`/proiecte/${project.id}`} className="block rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm hover:border-[#4f6d8f]">
                  <p className="font-semibold text-[#f2f9ff]">{project.title}</p>
                  <p className="text-xs text-[#9fb1c5]">{project.code} • {project.status} • Progres {project.progressPercent}%</p>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#f2f9ff]">Facturi</h2>
            <div className="mt-3 space-y-2">
              {client.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-sm">
                  <p className="font-semibold text-[#f2f9ff]">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-[#9fb1c5]">{formatDate(invoice.issueDate)} • Scadenta {formatDate(invoice.dueDate)} • {invoice.status}</p>
                  <p className="text-xs text-[#9fb1c5]">Total {formatCurrency(invoice.totalAmount.toString())} • Achitat {formatCurrency(invoice.paidAmount.toString())}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
