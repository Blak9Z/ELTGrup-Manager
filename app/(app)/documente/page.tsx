import { DocumentCategory } from "@prisma/client";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { parseEnumParam, parsePositiveIntParam } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { bulkDocumentsAction } from "./actions";
import { DocumentUploadForm } from "./document-upload-form";

export default async function DocumentePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const categoryFilter = parseEnumParam(params.category, Object.values(DocumentCategory));
  const page = parsePositiveIntParam(params.page);
  const pageSize = 24;
  const reminderThreshold = new Date();
  reminderThreshold.setDate(reminderThreshold.getDate() + 30);
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const scopedProjectFilter = scope.projectIds === null ? null : { in: scope.projectIds.length ? scope.projectIds : ["__none__"] };
  const roleKeys = session?.user?.roleKeys || [];
  const userEmail = session?.user?.email || null;
  const isClientViewer = roleKeys.includes("CLIENT_VIEWER");
  const canCreate = hasPermission(roleKeys, "DOCUMENTS", "CREATE", userEmail);
  const canUpdate = hasPermission(roleKeys, "DOCUMENTS", "UPDATE", userEmail);
  const canDelete = hasPermission(roleKeys, "DOCUMENTS", "DELETE", userEmail);

  const where = {
    ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter }),
    ...(isClientViewer ? { isPrivate: false } : {}),
    title: query ? { contains: query, mode: "insensitive" as const } : undefined,
    category: categoryFilter,
  };

  const [projects, clients, workOrders, docs, total] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null, ...(scope.projectIds === null ? {} : { id: scopedProjectFilter! }) },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.client.findMany({
      where:
        scope.projectIds === null
          ? { deletedAt: null }
          : { deletedAt: null, projects: { some: { id: scopedProjectFilter! } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter! }),
      },
      select: { id: true, title: true, project: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.document.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        fileName: true,
        version: true,
        storagePath: true,
        createdAt: true,
        tags: true,
        expiresAt: true,
        project: { select: { title: true } },
        client: { select: { name: true } },
        workOrder: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.document.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PermissionGuard resource="DOCUMENTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Documente" subtitle="Contracte, anexe, facturi, rapoarte, conformitate, permise" />

        {canCreate ? (
          <Card className="bulk-zone">
            <h2 className="text-lg font-extrabold">Inregistreaza document</h2>
            <DocumentUploadForm
              projects={projects.map((project) => ({ id: project.id, label: project.title }))}
              clients={clients.map((client) => ({ id: client.id, label: client.name }))}
              workOrders={workOrders.map((workOrder) => ({
                id: workOrder.id,
                label: `${workOrder.title} • ${workOrder.project.title}`,
              }))}
            />
          </Card>
        ) : null}

        <Card>
          <form className="mb-3 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="page" value="1" />
            <Input name="q" placeholder="Cauta document" defaultValue={query} />
            <select name="category" defaultValue={categoryFilter || ""} className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
              <option value="">Toate categoriile</option>
              {Object.values(DocumentCategory).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <Button type="submit" variant="secondary" className="h-10">
              Filtreaza
            </Button>
          </form>
          {canUpdate || canDelete ? (
            <form action={bulkDocumentsAction} className="mb-3 space-y-3">
              <div className="bulk-controls grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <select
                  name="operation"
                  defaultValue={canUpdate ? "MAKE_PRIVATE" : "DELETE"}
                  className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm"
                >
                  {canUpdate ? <option value="MAKE_PRIVATE">Marcheaza privat</option> : null}
                  {canUpdate ? <option value="MAKE_PUBLIC">Marcheaza public</option> : null}
                  {canDelete ? <option value="DELETE">Sterge definitiv</option> : null}
                </select>
                <div className="flex md:justify-end">
                  <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pe documentele selectate?" />
                </div>
              </div>
              <div className="grid gap-1 md:grid-cols-2 rounded-lg border border-[var(--border)] p-2">
                {docs.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2 text-sm">
                    <input className="h-4 w-4" type="checkbox" name="ids" value={doc.id} />
                    <span>{doc.title}</span>
                  </label>
                ))}
              </div>
            </form>
          ) : null}
          {docs.length === 0 ? (
            <EmptyState title="Nu exista documente pentru filtrele selectate" description="Incearca alte filtre sau adauga un document nou." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {docs.map((doc) => (
                <Card key={doc.id} className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{doc.title}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {doc.workOrder
                          ? `Lucrare: ${doc.workOrder.title}`
                          : doc.project?.title || doc.client?.name || "General"}
                      </p>
                    </div>
                    <Badge tone={doc.expiresAt && doc.expiresAt < reminderThreshold ? "warning" : "neutral"}>{doc.category}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">Fisier: {doc.fileName} • Versiune {doc.version}</p>
                  <p className="mt-1 text-xs text-[var(--muted)] break-all">Path: {doc.storagePath}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Creat la: {formatDate(doc.createdAt)}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Tag-uri: {doc.tags.join(", ") || "-"}</p>
                  <a href={doc.storagePath} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-xs font-semibold text-[#c6dbff] hover:underline">
                    Deschide document
                  </a>
                </Card>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--border-strong)]" href={`/documente?page=${page - 1}&q=${encodeURIComponent(query)}&category=${categoryFilter || ""}`}>
                  Anterior
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--border-strong)]" href={`/documente?page=${page + 1}&q=${encodeURIComponent(query)}&category=${categoryFilter || ""}`}>
                  Urmator
                </Link>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
