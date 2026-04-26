import Link from "next/link";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import type { AuthUserLike, isPrivilegedUser } from "@/src/lib/access-control";
import type { AccessScope } from "@/src/lib/access-scope";

export default async function ClientViewerDashboard({ userContext, scope }: { userContext: AuthUserLike; scope: AccessScope }) {
  const scopedProjectWhere = scope.projectIds === null ? {} : { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } };

  const projects = await prisma.project.findMany({
    where: { deletedAt: null, ...scopedProjectWhere },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      client: { select: { name: true } },
      phases: {
        select: { id: true, title: true, type: true, completed: true, startDate: true, endDate: true, position: true },
        orderBy: { position: "asc" },
      },
      installations: {
        where: { deletedAt: null },
        select: { id: true, name: true, status: true, certifiedAt: true, nextCheckAt: true },
        orderBy: { status: "asc" },
      },
      costs: { select: { amount: true } },
      invoices: { select: { totalAmount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const phaseTypeLabel: Record<string, string> = {
    OFERTARE: "Ofertare",
    PROIECTARE: "Proiectare",
    AVIZ_ISU: "Aviz ISU",
    AVIZ_SSM: "Aviz SSM",
    AVIZ_POMPIERI: "Aviz Pompieri",
    EXECUTIE: "Executie",
    RECEPTIE_PSI: "Receptie PSI",
    MENTENANTA: "Mentenanta",
  };

  const completedPhases = projects.reduce(
    (acc, p) => acc + p.phases.filter((ph) => ph.completed).length,
    0,
  );
  const totalPhases = projects.reduce((acc, p) => acc + p.phases.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vizibilitate proiecte"
        subtitle={`Viziteaza progresul proiectelor tale si fazele de avizare${userContext.email ? ` (${userContext.email})` : ""}`}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Proiecte active</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{projects.length}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Faze finalizate</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {totalPhases > 0 ? `${Math.round((completedPhases / totalPhases) * 100)}%` : "-"}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Instalatii active</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {projects.reduce((acc, p) => acc + p.installations.length, 0)}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Valoare totala</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {projects
              .reduce((acc, p) => acc + (p.costs.reduce((c, cost) => c + Number(cost.amount), 0) || 0), 0)
              .toLocaleString("ro-RO")} RON
          </p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {projects.map((project) => {
          const avizPhases = project.phases.filter((p) => ["AVIZ_ISU", "AVIZ_SSM", "AVIZ_POMPIERI", "RECEPTIE_PSI"].includes(p.type));
          const execPhases = project.phases.filter((p) => !["AVIZ_ISU", "AVIZ_SSM", "AVIZ_POMPIERI", "RECEPTIE_PSI"].includes(p.type));
          const overdueAviz = avizPhases.filter((p) => !p.completed && p.endDate && new Date(p.endDate) < new Date()).length;

          return (
            <Card key={project.id}>
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">{project.title}</h2>
                    <p className="text-xs text-[var(--muted)]">{project.code} — {project.client.name}</p>
                  </div>
                  <Link href={`/proiecte/${project.id}`} className="text-xs text-[var(--accent)] hover:underline">
                    Deschide →
                  </Link>
                </div>

                {avizPhases.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Faze de avizare</p>
                    <div className="space-y-1.5">
                      {avizPhases.map((phase) => {
                        const daysLeft = phase.endDate
                          ? Math.ceil((new Date(phase.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : null;
                        return (
                          <div
                            key={phase.id}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                              phase.completed
                                ? "border-[rgba(79,156,118,0.35)] bg-[rgba(79,156,118,0.08)]"
                                : daysLeft !== null && daysLeft < 0
                                  ? "border-[rgba(190,95,111,0.35)] bg-[rgba(190,95,111,0.08)]"
                                  : "border-[var(--border)] bg-[var(--surface-card)]"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-[var(--foreground)] text-sm">
                                {phaseTypeLabel[phase.type] || phase.title}
                              </p>
                              {phase.startDate && phase.endDate ? (
                                <p className="text-[11px] text-[var(--muted)]">
                                  {formatDate(phase.startDate)} → {formatDate(phase.endDate)}
                                </p>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-xs">
                              {phase.completed ? (
                                <span className="font-semibold text-[#bde7cf]">Finalizata</span>
                              ) : daysLeft !== null ? (
                                <span className={daysLeft < 0 ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}>
                                  {daysLeft < 0 ? `Depasit ${Math.abs(daysLeft)} zile` : `${daysLeft} zile`}
                                </span>
                              ) : (
                                <span className="text-[var(--muted)]">In desfasurare</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {overdueAviz > 0 && (
                      <p className="mt-1 text-[11px] text-[var(--danger)]">⚠️ {overdueAviz} faza/faze cu termen depasit</p>
                    )}
                  </div>
                )}

                {execPhases.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Executie</p>
                    <div className="space-y-1.5">
                      {execPhases.map((phase) => (
                        <div key={phase.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                          <p className="truncate text-sm text-[var(--muted-strong)]">
                            {phaseTypeLabel[phase.type] || phase.title}
                            {phase.completed && <span className="ml-2 text-[10px] font-semibold text-emerald-400">✓</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {project.installations.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Instalatii</p>
                    <div className="space-y-1.5">
                      {project.installations.map((inst) => (
                        <div key={inst.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                          <span className="text-sm text-[var(--muted-strong)]">
                            {inst.name} — {inst.status}
                          </span>
                          {inst.nextCheckAt && (
                            <span className="text-[11px] text-[var(--muted)]">Verificare {formatDate(inst.nextCheckAt)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
