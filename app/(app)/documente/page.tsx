import { DocumentCategory } from "@prisma/client";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
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

  const where = {
    title: params.q ? { contains: params.q, mode: "insensitive" as const } : undefined,
    category: params.category || undefined,
  };

  const [projects, clients, docs, total] = await Promise.all([
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.client.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
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

        <Card>
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
            <select name="category" defaultValue={params.category || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
              <option value="">Toate categoriile</option>
              {Object.values(DocumentCategory).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg border border-[#cfddd3] bg-white px-3 text-sm font-semibold text-[#2b4133]">Filtreaza</button>
          </form>
          <form action={bulkDocumentsAction} className="mb-3 space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <select name="operation" defaultValue="MAKE_PRIVATE" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
                <option value="MAKE_PRIVATE">Marcheaza privat</option>
                <option value="MAKE_PUBLIC">Marcheaza public</option>
                <option value="DELETE">Sterge definitiv</option>
              </select>
              <div />
              <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pe documentele selectate?" />
            </div>
            <div className="grid gap-1 md:grid-cols-2 rounded-lg border border-[#dce8df] p-2">
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
                    <p className="text-xs text-[#62756a]">{doc.project?.title || doc.client?.name || "General"}</p>
                  </div>
                  <Badge tone={doc.expiresAt && doc.expiresAt < reminderThreshold ? "warning" : "neutral"}>{doc.category}</Badge>
                </div>
                <p className="mt-2 text-xs text-[#5b6f62]">Fisier: {doc.fileName} • Versiune {doc.version}</p>
                <p className="mt-1 text-xs text-[#5b6f62]">Path: {doc.storagePath}</p>
                <p className="mt-1 text-xs text-[#5b6f62]">Creat la: {formatDate(doc.createdAt)}</p>
                <p className="mt-1 text-xs text-[#5b6f62]">Tag-uri: {doc.tags.join(", ") || "-"}</p>
              </Card>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[#5f7265]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <a className="rounded-md border border-[#cfdcd2] px-3 py-1" href={`/documente?page=${page - 1}&q=${encodeURIComponent(params.q || "")}&category=${params.category || ""}`}>Anterior</a>
              ) : null}
              {page < totalPages ? (
                <a className="rounded-md border border-[#cfdcd2] px-3 py-1" href={`/documente?page=${page + 1}&q=${encodeURIComponent(params.q || "")}&category=${params.category || ""}`}>Urmator</a>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
