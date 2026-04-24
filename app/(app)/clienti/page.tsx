import { ClientType, Prisma } from "@prisma/client";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { Textarea } from "@/src/components/ui/textarea";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { buildListHref, parseEnumParam, parsePositiveIntParam, resolvePagination } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";
import { addClientNote, archiveClient, bulkArchiveClientsAction } from "./actions";
import { ClientCreateForm } from "./client-create-form";

const clientTypeLabels: Record<ClientType, string> = {
  COMPANY: "Companie",
  INDIVIDUAL: "Persoana fizica",
  PUBLIC_INSTITUTION: "Institutie publica",
  NGO: "ONG",
  OTHER: "Alt tip",
};

const clientTypeOptions = Object.values(ClientType);
const archiveVisibilityOptions = ["active", "archived", "all"] as const;
type ArchiveVisibility = (typeof archiveVisibilityOptions)[number];
const archiveVisibilityLabels: Record<ArchiveVisibility, string> = {
  active: "Active",
  archived: "Arhivate",
  all: "Toate",
};

function buildClientiHref({
  page,
  q,
  type,
  archived,
  dialog,
}: {
  page?: number;
  q?: string;
  type?: ClientType | null;
  archived?: ArchiveVisibility;
  dialog?: "create";
}) {
  return buildListHref("/clienti", {
    page,
    q,
    type: type || undefined,
    archived: archived === "active" ? undefined : archived,
    dialog,
  });
}

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; type?: string; dialog?: string; archived?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const typeFilter = parseEnumParam(params.type, clientTypeOptions);
  const archivedFilter = parseEnumParam(params.archived, archiveVisibilityOptions) || "active";
  const page = parsePositiveIntParam(params.page);
  const pageSize = 12;
  const createDialogOpen = params.dialog === "create";
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
  const canCreate = hasPermission(roleKeys, "PROJECTS", "CREATE", userEmail);
  const canUpdate = hasPermission(roleKeys, "PROJECTS", "UPDATE", userEmail);
  const canDelete = hasPermission(roleKeys, "PROJECTS", "DELETE", userEmail);
  const scopedProjectIds = scope.projectIds === null ? null : scope.projectIds.length ? scope.projectIds : ["__none__"];
  const where: Prisma.ClientWhereInput = {};
  const andFilters: Prisma.ClientWhereInput[] = [];

  if (archivedFilter === "active") {
    where.deletedAt = null;
  } else if (archivedFilter === "archived") {
    where.deletedAt = { not: null };
  }

  if (scopedProjectIds) {
    andFilters.push({ projects: { some: { id: { in: scopedProjectIds } } } });
  }
  if (typeFilter) {
    andFilters.push({ type: typeFilter });
  }
  if (query) {
    andFilters.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { cui: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
        { billingAddress: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
        {
          contacts: {
            some: {
              OR: [
                { fullName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
                { roleTitle: { contains: query, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }
  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  const totalClients = await prisma.client.count({ where });
  const { totalPages, currentPage, skip, take } = resolvePagination({
    page,
    totalItems: totalClients,
    pageSize,
  });
  const clients = await prisma.client.findMany({
    where,
    select: {
      id: true,
      type: true,
      name: true,
      cui: true,
      email: true,
      phone: true,
      billingAddress: true,
      notes: true,
      deletedAt: true,
      _count: { select: { projects: true, contacts: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip,
    take,
  });
  const hasFilters = Boolean(query || typeFilter || archivedFilter !== "active");
  const activeClientsOnPage = clients.filter((client) => !client.deletedAt);
  const createHref = buildClientiHref({ page: currentPage, q: query, type: typeFilter, archived: archivedFilter, dialog: "create" });
  const closeHref = buildClientiHref({ page: currentPage, q: query, type: typeFilter, archived: archivedFilter });
  const prevHref = currentPage > 1 ? buildClientiHref({ page: currentPage - 1, q: query, type: typeFilter, archived: archivedFilter, dialog: createDialogOpen ? "create" : undefined }) : null;
  const nextHref = currentPage < totalPages ? buildClientiHref({ page: currentPage + 1, q: query, type: typeFilter, archived: archivedFilter, dialog: createDialogOpen ? "create" : undefined }) : null;

  return (
    <PermissionGuard resource="PROJECTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="CRM Clienti"
          subtitle="Date companie, contacte, proiecte, note operationale si istoric"
          actions={
            canCreate ? (
              <form method="get" action={createHref}>
                <Button type="submit">Adauga client</Button>
              </form>
            ) : null
          }
        />

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{totalClients} clienti gasiti</Badge>
            {hasFilters ? <Badge tone="info">Filtru activ</Badge> : <Badge tone="success">Fara filtre</Badge>}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.85fr)_minmax(200px,0.85fr)_auto]">
            <form method="get" action="/clienti" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.85fr)_minmax(200px,0.85fr)_auto] lg:col-span-2">
              <input type="hidden" name="page" value="1" />
              <Input
                name="q"
                defaultValue={query}
                placeholder="Cauta dupa nume, CUI, email, telefon, nota sau contact"
              />
              <select
                name="type"
                defaultValue={typeFilter || ""}
                className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
              >
                <option value="">Toate tipurile</option>
                {clientTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {clientTypeLabels[type]}
                  </option>
                ))}
              </select>
              <select
                name="archived"
                defaultValue={archivedFilter}
                className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
              >
                {archiveVisibilityOptions.map((option) => (
                  <option key={option} value={option}>
                    {archiveVisibilityLabels[option]}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" className="w-full lg:w-auto">
                Aplica filtre
              </Button>
            </form>
            {hasFilters ? (
              <form method="get" action="/clienti" className="lg:self-end">
                <Button type="submit" variant="ghost" className="w-full lg:w-auto">
                  Reseteaza
                </Button>
              </form>
            ) : null}
          </div>
        </Card>

        {canCreate && createDialogOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(7,12,18,0.74)] p-3 sm:items-center sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="client-create-title"
              className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-panel)]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Create client</p>
                  <h2 id="client-create-title" className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                    Adauga client
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Deschide formularul intr-un dialog ca sa poti ramane pe lista curenta si sa revii rapid dupa salvare.
                  </p>
                </div>
                <form method="get" action={closeHref}>
                  <Button type="submit" variant="ghost" size="sm" aria-label="Inchide formularul">
                    Inchide
                  </Button>
                </form>
              </div>
              <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-5">
                <ClientCreateForm />
              </div>
            </div>
          </div>
        ) : null}

        {canDelete ? (
          <Card className="bulk-zone">
            <details>
              <summary>Actiuni bulk clienti</summary>
              <form action={bulkArchiveClientsAction} className="mt-3 space-y-3">
                <div className="bulk-controls flex flex-wrap items-center gap-2">
                  <Badge tone="warning">Arhivare soft delete</Badge>
                  <ConfirmSubmitButton
                    text="Arhiveaza selectia"
                    confirmMessage="Confirmi arhivarea clientilor selectati?"
                    variant="destructive"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  {activeClientsOnPage.length > 0 ? (
                    <div className="grid gap-1 md:grid-cols-2">
                      {activeClientsOnPage.map((client) => (
                        <label key={client.id} className="flex items-center gap-2 text-sm text-[#d9e8fb]">
                          <input type="checkbox" name="ids" value={client.id} className="h-4 w-4" />
                          <span>{client.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">Nu exista clienti activi pe pagina curenta pentru arhivare.</p>
                  )}
                </div>
              </form>
            </details>
          </Card>
        ) : null}

        {clients.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Nu exista clienti care sa corespunda filtrelor" : "Nu exista clienti in aria ta de acces"}
            description={
              hasFilters
                ? "Sterge filtrele sau ajusteaza cautarea pentru a vedea alte rezultate."
                : "Creeaza primul client pentru a porni fluxul CRM si asocierea cu proiecte."
            }
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id} className="space-y-3">
              {client.deletedAt ? <Badge tone="warning">Arhivat</Badge> : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/clienti/${client.id}`} className="text-base font-bold text-[#c8dcff] hover:underline">
                    {client.name}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">{client.cui || "Fara CUI"}</p>
                  <div className="mt-2">
                    <Badge tone="neutral">{clientTypeLabels[client.type]}</Badge>
                  </div>
                </div>
                <Badge tone="neutral">CRM</Badge>
              </div>
              <p className="text-sm text-[var(--muted-strong)] break-words">{client.email || "-"} • {client.phone || "-"}</p>
              <p className="text-xs text-[var(--muted)] break-words">Adresa: {client.billingAddress || "-"}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                <p>Proiecte: {client._count.projects}</p>
                <p>Contacte: {client._count.contacts}</p>
              </div>
              <p className="text-xs text-[var(--muted)]">Note curente: {client.notes || "-"}</p>

              {canUpdate && !client.deletedAt ? (
                <form action={addClientNote} className="mt-3 space-y-2">
                  <input type="hidden" name="id" value={client.id} />
                  <Textarea name="note" rows={2} placeholder="Adauga nota operationala" />
                  <Button type="submit" size="sm" variant="secondary">
                    Salveaza nota
                  </Button>
                </form>
              ) : null}
              {canDelete && !client.deletedAt ? (
                <form action={archiveClient} className="mt-2">
                  <input type="hidden" name="id" value={client.id} />
                  <ConfirmSubmitButton
                    text="Arhiveaza client"
                    confirmMessage={`Confirmi arhivarea clientului ${client.name}?`}
                    variant="destructive"
                  />
                </form>
              ) : null}
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
          <span>
            Pagina {currentPage} din {totalPages}
          </span>
          <div className="flex gap-2">
            {prevHref ? (
              <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]" href={prevHref}>
                Anterior
              </Link>
            ) : null}
            {nextHref ? (
              <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]" href={nextHref}>
                Urmator
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
