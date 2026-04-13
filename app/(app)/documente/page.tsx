import { DocumentCategory } from "@prisma/client";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { bulkDocumentsAction } from "./actions";
import { DocumentUploadForm } from "./document-upload-form";

export default async function DocumentePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: DocumentCategory; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || "1"));
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
  const isClientViewer = (session?.user?.roleKeys || []).includes("CLIENT_VIEWER");

  const where = {
    ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter }),
    ...(isClientViewer ? { isPrivate: false } : {}),
    title: params.q ? { contains: params.q, mode: "insensitive" as const } : undefined,
    category: params.category || undefined,
  };

  const [projects, clients, docs, total] = await Promise.all([
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
    prisma.document.findMany({
      where,
      include: { project: true, client: true },
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

        <Card className="bulk-zone">
          <h2 className="text-lg font-extrabold">Inregistreaza document</h2>
          <DocumentUploadForm
            projects={projects.map((project) => ({ id: project.id, label: project.title }))}
            clients={clients.map((client) => ({ id: client.id, label: client.name }))}
          />
        </Card>

        <Card>
          <form className="mb-3 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="page" value="1" />
            <Input name="q" placeholder="Cauta document" defaultValue={params.q || ""} />
            <select name="category" defaultValue={params.category || ""} className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
              <option value="">Toate categoriile</option>
              {Object.values(DocumentCategory).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg border border-[var(--border)] bg-[rgba(16,27,47,0.88)] px-3 text-sm font-semibold text-[#dce7f9]">Filtreaza</button>
          </form>
          <form action={bulkDocumentsAction} className="mb-3 space-y-3">
            <div className="bulk-controls grid gap-2 md:grid-cols-3">
              <select name="operation" defaultValue="MAKE_PRIVATE" className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
                <option value="MAKE_PRIVATE">Marcheaza privat</option>
                <option value="MAKE_PUBLIC">Marcheaza public</option>
                <option value="DELETE">Sterge definitiv</option>
              </select>
              <div />
              <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pe documentele selectate?" />
            </div>
            <div className="grid gap-1 md:grid-cols-2 rounded-lg border border-[var(--border)] p-2">
              {docs.map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="ids" value={doc.id} />
                  <span>{doc.title}</span>
                </label>
              ))}
            </div>
          </form>
          <div className="grid gap-3 md:grid-cols-2">
            {docs.map((doc) => (
              <Card key={doc.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{doc.title}</p>
                    <p className="text-xs text-[#9fb3ce]">{doc.project?.title || doc.client?.name || "General"}</p>
                  </div>
                  <Badge tone={doc.expiresAt && doc.expiresAt < reminderThreshold ? "warning" : "neutral"}>{doc.category}</Badge>
                </div>
                <p className="mt-2 text-xs text-[#9fb3ce]">Fisier: {doc.fileName} • Versiune {doc.version}</p>
                <p className="mt-1 text-xs text-[#9fb3ce]">Path: {doc.storagePath}</p>
                <p className="mt-1 text-xs text-[#9fb3ce]">Creat la: {formatDate(doc.createdAt)}</p>
                <p className="mt-1 text-xs text-[#9fb3ce]">Tag-uri: {doc.tags.join(", ") || "-"}</p>
                <a href={doc.storagePath} target="_blank" className="mt-2 inline-block text-xs font-semibold text-[#c6dbff] hover:underline">
                  Deschide document
                </a>
              </Card>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[#9fb3ce]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <a className="rounded-md border border-[var(--border)] px-3 py-1" href={`/documente?page=${page - 1}&q=${encodeURIComponent(params.q || "")}&category=${params.category || ""}`}>Anterior</a>
              ) : null}
              {page < totalPages ? (
                <a className="rounded-md border border-[var(--border)] px-3 py-1" href={`/documente?page=${page + 1}&q=${encodeURIComponent(params.q || "")}&category=${params.category || ""}`}>Urmator</a>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
