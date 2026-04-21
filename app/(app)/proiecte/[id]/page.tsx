import { DocumentCategory } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { ActivityTimeline } from "@/src/components/ui/activity-timeline";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { assertProjectAccess } from "@/src/lib/access-scope";
import { buildProjectTimeline } from "@/src/lib/timeline";
import { formatCurrency, formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";

const documentCategoryLabels: Record<DocumentCategory, string> = {
  CONTRACT: "Contract",
  ANNEX: "Anexa",
  OFFER: "Oferta",
  INVOICE: "Factura",
  DELIVERY_NOTE: "Aviz livrare",
  SITE_REPORT: "Raport santier",
  PHOTO: "Foto",
  COMPLIANCE: "Conformitate",
  PERMIT: "Autorizatie",
  HANDOVER: "Predare",
  OTHER: "Altele",
};

const planSections = [
  {
    key: "fire-detection",
    label: "Detectie incendiu",
    description: "Alarme, detectoare, sprinklere si scenarii de interventie.",
    sampleTag: "plan:fire-detection",
    searchTerms: ["fire detection", "detecție incendiu", "incendiu", "sprinkler", "alarm", "idf"],
  },
  {
    key: "electrical",
    label: "Instalatii electrice",
    description: "Circuite de putere, iluminat, tablouri si alimentari.",
    sampleTag: "plan:electrical",
    searchTerms: ["electrical", "instalatii electrice", "electric", "tablou", "iluminat", "power"],
  },
  {
    key: "hvac",
    label: "HVAC",
    description: "Ventilatie, climatizare, incalzire si echipamente HVAC.",
    sampleTag: "plan:hvac",
    searchTerms: ["hvac", "ventilatie", "climatizare", "aer conditionat", "incalzire", "vent"],
  },
  {
    key: "sanitary-plumbing",
    label: "Sanitar / plumbing",
    description: "Apa, canalizare, drenaj si instalatii sanitare.",
    sampleTag: "plan:sanitary-plumbing",
    searchTerms: ["sanitar", "plumbing", "instalatii sanitare", "apa", "canalizare", "drain"],
  },
  {
    key: "low-current",
    label: "Curenti slabi",
    description: "CCTV, acces, interfon, date, BMS si retele low-voltage.",
    sampleTag: "plan:low-current",
    searchTerms: ["curenti slabi", "low current", "low voltage", "cctv", "interfon", "bms", "network"],
  },
  {
    key: "architecture",
    label: "Arhitectura",
    description: "Planse de arhitectura, fatade, sectiuni si detalii de amenajare.",
    sampleTag: "plan:architecture",
    searchTerms: ["architecture", "arhitectura", "arh", "fatada", "section", "layout"],
  },
  {
    key: "structure",
    label: "Structura",
    description: "Fundatii, cadre, placi, armare si detalii de rezistenta.",
    sampleTag: "plan:structure",
    searchTerms: ["structure", "structura", "rezistenta", "fundatie", "beton", "armare"],
  },
] as const;

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchesPlanSection(
  document: {
    title: string;
    fileName: string;
    category: DocumentCategory;
    tags: string[];
  },
  section: (typeof planSections)[number],
) {
  const haystack = normalizeText([document.title, document.fileName, document.category, ...document.tags].join(" "));
  return document.tags.some((tag) => normalizeText(tag) === section.sampleTag) || section.searchTerms.some((term) => haystack.includes(normalizeText(term)));
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (session?.user) {
    await assertProjectAccess(
      {
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      },
      id,
    ).catch(() => notFound());
  }

  const project = await prisma.project.findUnique({
    where: { id, deletedAt: null },
    include: {
      client: true,
      manager: true,
      phases: { orderBy: { position: "asc" } },
      workOrders: { where: { deletedAt: null }, orderBy: { dueDate: "asc" }, take: 15 },
      materialUsage: { include: { material: true }, orderBy: { loggedAt: "desc" }, take: 10 },
      invoices: { orderBy: { dueDate: "desc" }, take: 10 },
      costs: { orderBy: { occurredAt: "desc" }, take: 12 },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          category: true,
          fileName: true,
          version: true,
          isPrivate: true,
          createdAt: true,
          tags: true,
          expiresAt: true,
          project: { select: { id: true, title: true } },
          client: { select: { id: true, name: true } },
          workOrder: { select: { id: true, title: true } },
        },
      },
      dailyReports: { orderBy: { reportDate: "desc" }, take: 10 },
      subcontractors: { include: { subcontractor: true }, take: 10 },
    },
  });

  if (!project) notFound();

  const totalCost = project.costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
  const totalInvoiced = project.invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
  const timeline = await buildProjectTimeline(id, 40);
  const planDocumentIds = new Set<string>();
  const planGroups = planSections.map((section) => {
    const docs = project.documents.filter((document) => !planDocumentIds.has(document.id) && matchesPlanSection(document, section));
    docs.forEach((document) => planDocumentIds.add(document.id));
    return { ...section, docs };
  });
  const generalDocuments = project.documents.filter((document) => !planDocumentIds.has(document.id));
  const planDocumentCount = planGroups.reduce((sum, group) => sum + group.docs.length, 0);

  return (
    <PermissionGuard resource="PROJECTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title={project.title}
          subtitle={`${project.code} • ${project.client.name} • ${project.siteAddress}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={`/calendar?projectId=${project.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Calendar
              </Link>
              <Link href={`/pontaj?projectId=${project.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Pontaj
              </Link>
              <Link href={`/rapoarte-zilnice?projectId=${project.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Rapoarte
              </Link>
              <Link href="/proiecte" className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Inapoi
              </Link>
            </div>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Status</p>
            <div className="mt-2">
              <Badge tone={project.status === "ACTIVE" ? "success" : project.status === "BLOCKED" ? "danger" : "neutral"}>{project.status}</Badge>
            </div>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Buget estimat</p>
            <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{formatCurrency(project.estimatedBudget?.toString() || 0)}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Cost real</p>
            <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{formatCurrency(totalCost)}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Facturat</p>
            <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{formatCurrency(totalInvoiced)}</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Lucrari active</h2>
            <div className="mt-3 space-y-2">
              {project.workOrders.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista lucrari active pe acest proiect.
                </p>
              ) : null}
              {project.workOrders.map((task) => (
                <div key={task.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{task.title}</p>
                  <p className="text-xs text-[#a0b3ce]">
                    Status {task.status} • Prioritate {task.priority} • Termen {task.dueDate ? formatDate(task.dueDate) : "-"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Faze proiect</h2>
            <div className="mt-3 space-y-2">
              {project.phases.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista faze definite pentru acest proiect.
                </p>
              ) : null}
              {project.phases.map((phase) => (
                <div key={phase.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">
                    {phase.position}. {phase.title}
                  </p>
                  <p className="text-xs text-[#a0b3ce]">{phase.completed ? "Finalizata" : "In progres"}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Planuri proiect</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Folosim documentele deja incarcate si le grupam dupa disciplina. Pune tag-uri ca <span className="font-semibold text-[var(--foreground)]">{planSections[0].sampleTag}</span> pentru o clasificare mai precisa.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">{planDocumentCount} planuri</Badge>
              <Badge tone="neutral">{generalDocuments.length} alte documente</Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {planGroups.map((group) => (
              <div key={group.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-panel)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Plan</p>
                    <h3 className="text-base font-semibold text-[var(--foreground)]">{group.label}</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">{group.description}</p>
                  </div>
                  <Badge tone={group.docs.length ? "success" : "neutral"}>{group.docs.length}</Badge>
                </div>

                {group.docs.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {group.docs.slice(0, 3).map((document) => (
                      <div key={document.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface)] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-semibold text-[var(--foreground)]">{document.title}</p>
                            <p className="text-xs text-[var(--muted)]">
                              {document.fileName} • {document.project?.title || document.workOrder?.title || "Document"}
                            </p>
                          </div>
                          <Badge tone={document.isPrivate ? "neutral" : "success"}>{document.isPrivate ? "Privat" : "Public"}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a
                            href={`/api/documents/${document.id}/download`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--border-strong)]"
                          >
                            Deschide
                          </a>
                          <Link
                            href={`/documente?projectId=${project.id}`}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted-strong)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                          >
                            Incarca alt plan
                          </Link>
                        </div>
                      </div>
                    ))}
                    {group.docs.length > 3 ? <p className="text-xs text-[var(--muted)]">+ {group.docs.length - 3} alte documente in aceasta categorie.</p> : null}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
                    Niciun document identificat inca. Foloseste tag-ul <span className="font-semibold text-[var(--foreground)]">{group.sampleTag}</span> sau include disciplina in titlu.
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Documente asociate</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Contracte, rapoarte, imagini, avize si alte fisiere care nu se incadreaza in sectiunea de planuri.</p>
              </div>
              <Link
                href={`/documente?projectId=${project.id}`}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3.5 text-sm font-semibold text-[var(--muted-strong)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
              >
                Deschide in Documente
              </Link>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {generalDocuments.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)] md:col-span-2">
                  Nu exista alte documente asociate acestui proiect.
                </p>
              ) : null}
              {generalDocuments.map((document) => (
                <div key={document.id} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold text-[var(--foreground)]">{document.title}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {document.fileName} • {formatDate(document.createdAt)}
                      </p>
                    </div>
                    <Badge tone={document.isPrivate ? "neutral" : "success"}>{document.isPrivate ? "Privat" : "Public"}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="info">{documentCategoryLabels[document.category]}</Badge>
                    {document.expiresAt ? <Badge tone={document.expiresAt < new Date() ? "warning" : "neutral"}>{`Expira ${formatDate(document.expiresAt)}`}</Badge> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/api/documents/${document.id}/download`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--border-strong)]"
                    >
                      Deschide
                    </a>
                    {document.workOrder ? (
                      <Link
                        href={`/lucrari/${document.workOrder.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted-strong)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                      >
                        Lucrare
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Consum materiale</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.materialUsage.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista consum de materiale inregistrat.
                </p>
              ) : null}
              {project.materialUsage.map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-[var(--foreground)]">{item.material.name}</p>
                  <p className="text-xs text-[#a0b3ce]">
                    Consum: {item.quantityUsed.toString()} {item.material.unitOfMeasure}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Facturi</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.invoices.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista facturi asociate acestui proiect.
                </p>
              ) : null}
              {project.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-[var(--foreground)]">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-[#a0b3ce]">
                    {formatCurrency(invoice.totalAmount.toString())} • Scadenta {formatDate(invoice.dueDate)} • {invoice.status}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Rapoarte zilnice</h2>
            <div className="mt-3 space-y-2 text-sm">
              {project.dailyReports.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista rapoarte zilnice in acest moment.
                </p>
              ) : null}
              {project.dailyReports.map((report) => (
                <div key={report.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-[var(--foreground)]">{formatDate(report.reportDate)}</p>
                  <p className="text-xs text-[#a0b3ce]">{report.workCompleted}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Subcontractori</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {project.subcontractors.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)] md:col-span-2">
                  Nu exista subcontractori alocati pe acest proiect.
                </p>
              ) : null}
              {project.subcontractors.map((assignment) => (
                <div key={assignment.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{assignment.subcontractor.name}</p>
                  <p className="text-xs text-[#a0b3ce]">Status {assignment.status} • Contract {assignment.contractRef || "-"}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Timeline proiect (operational)</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Un singur fir cronologic pentru update-uri, documente, costuri, materiale, lucrari si facturi.</p>
          <div className="mt-3">
            <ActivityTimeline events={timeline} />
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
