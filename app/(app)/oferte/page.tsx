import Link from "next/link";
import { OfferStatus } from "@prisma/client";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageHeader } from "@/src/components/ui/page-header";
import { TD, TH, Table } from "@/src/components/ui/table";
import { FormModal } from "@/src/components/forms/form-modal";
import { auth } from "@/src/lib/auth";
import { formatCurrency, formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { hasPermission } from "@/src/lib/rbac";
import { archiveOffer, updateOfferStatus, convertOfferToProject } from "./actions";
import { OfferCreateForm } from "./offer-create-form";

const offerStatusMeta: Record<OfferStatus, { label: string; tone: "neutral" | "info" | "danger" | "success" | "warning" }> = {
  DRAFT: { label: "Ciorna", tone: "neutral" },
  SENT: { label: "Trimisa", tone: "info" },
  ACCEPTED: { label: "Acceptata", tone: "success" },
  REJECTED: { label: "Respinsa", tone: "danger" },
  EXPIRED: { label: "Expirata", tone: "warning" },
};

export default async function OfertePage() {
  const session = await auth();
  const roleKeys = session?.user?.roleKeys || [];
  const userEmail = session?.user?.email || null;
  const canCreate = hasPermission(roleKeys, "OFFERS", "CREATE", userEmail);
  const canUpdate = hasPermission(roleKeys, "OFFERS", "UPDATE", userEmail);
  const canDelete = hasPermission(roleKeys, "OFFERS", "DELETE", userEmail);

  const offers = await prisma.offer.findMany({
    where: { deletedAt: null },
    include: { client: { select: { name: true } }, items: { select: { id: true } }, project: { select: { code: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 50,
  });

  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <PermissionGuard resource="OFFERS" action="VIEW">
      <div className="page-stack">
        <PageHeader
          title="Oferte tehnice"
          subtitle="Ofertare - oferta trimisa - acceptata - convertita in proiect. Pipeline comercial complet."
        />

        <div className="flex flex-wrap items-center gap-3">
          {canCreate && (
            <FormModal triggerLabel="+ Oferta noua" title="Creare oferta tehnica">
              <OfferCreateForm clients={clients} />
            </FormModal>
          )}
        </div>

        {offers.length === 0 ? (
          <EmptyState
            title="Nicio oferta"
            description="Creeaza prima oferta tehnica pentru un client. Pipeline-ul comercial porneste aici."
          />
        ) : (
          <Card className="overflow-auto p-0">
            <Table className="min-w-[900px]">
              <thead>
                <tr className="bg-[var(--surface-2)]">
                  <TH>Cod</TH>
                  <TH>Titlu</TH>
                  <TH>Client</TH>
                  <TH>Status</TH>
                  <TH>Pozitii</TH>
                  <TH>Valoare</TH>
                  <TH>Valabila pana la</TH>
                  <TH>Proiect</TH>
                  <TH className="text-right">Actiuni</TH>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => {
                  const meta = offerStatusMeta[offer.status];
                  return (
                    <tr key={offer.id} className="group border-b border-[var(--border)]">
                      <TD className="font-mono text-xs">{offer.code}</TD>
                      <TD>{offer.title}</TD>
                      <TD className="text-[var(--muted)]">{offer.client?.name}</TD>
                      <TD>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </TD>
                      <TD className="text-center">{offer.items.length}</TD>
                      <TD className="text-right font-semibold">{formatCurrency(Number(offer.totalAmount))}</TD>
                      <TD>{formatDate(offer.validUntil)}</TD>
                      <TD>
                        {offer.project ? (
                          <Link href={`/proiecte/${offer.projectId}`} className="text-xs text-[var(--accent)] hover:underline">
                            {offer.project.code}
                          </Link>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">—</span>
                        )}
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          {canUpdate && offer.status !== OfferStatus.ACCEPTED && (
                            <form action={updateOfferStatus}>
                              <input type="hidden" name="id" value={offer.id} />
                              <input type="hidden" name="status" value="SENT" />
                              <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                Trimite
                              </Button>
                            </form>
                          )}
                          {canUpdate && offer.status === OfferStatus.SENT && (
                            <form action={updateOfferStatus}>
                              <input type="hidden" name="id" value={offer.id} />
                              <input type="hidden" name="status" value="ACCEPTED" />
                              <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-400">
                                Accepta
                              </Button>
                            </form>
                          )}
                          {canUpdate && offer.status === OfferStatus.ACCEPTED && !offer.projectId && (
                            <form action={convertOfferToProject}>
                              <input type="hidden" name="id" value={offer.id} />
                              <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs text-[var(--accent)]">
                                → Proiect
                              </Button>
                            </form>
                          )}
                          {canDelete && (
                            <form action={archiveOffer}>
                              <input type="hidden" name="id" value={offer.id} />
                              <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs text-[var(--danger)]">
                                Arhivare
                              </Button>
                            </form>
                          )}
                        </div>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </PermissionGuard>
  );
}
