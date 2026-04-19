import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import Link from "next/link";
import { Textarea } from "@/src/components/ui/textarea";
import { auth } from "@/src/lib/auth";
import { projectScopeWhere, resolveAccessScope, workOrderScopeWhere } from "@/src/lib/access-scope";
import { formatDateTime } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import {
  checkInOnSite,
  checkOutOnSite,
  createFieldUpdate,
  pauseLivePontaj,
  resumeLivePontaj,
  startLivePontaj,
  stopLivePontaj,
  uploadTaskPhoto,
} from "./actions";

function todayDateAtMidnight() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export default async function TerenPage() {
  const session = await auth();
  const today = todayDateAtMidnight();
  const userContext = {
    id: session?.user?.id || "",
    email: session?.user?.email || null,
    roleKeys: session?.user?.roleKeys || [],
  };
  const scope = session?.user
    ? await resolveAccessScope(userContext)
    : { projectIds: null, teamId: null };

  const [tasks, activeEntry, attendance, projects, reports] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        ...workOrderScopeWhere(userContext, scope),
        status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
      },
      select: {
        id: true,
        projectId: true,
        title: true,
        status: true,
        priority: true,
        project: { select: { title: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.timeEntry.findFirst({
      where: {
        userId: session?.user?.id,
        endAt: null,
        liveState: { in: ["RUNNING", "PAUSED"] },
      },
      select: {
        id: true,
        startAt: true,
        liveState: true,
        project: { select: { title: true } },
        workOrder: { select: { title: true } },
      },
      orderBy: { startAt: "desc" },
    }),
    prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: session?.user?.id || "",
          date: today,
        },
      },
    }),
    prisma.project.findMany({
      where: { deletedAt: null, ...projectScopeWhere(scope.projectIds) },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.dailySiteReport.findMany({
      where:
        scope.projectIds === null
          ? {}
          : { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
      select: {
        id: true,
        createdAt: true,
        workCompleted: true,
        blockers: true,
        project: { select: { title: true } },
        workOrder: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);
  const reportsWithBlockers = reports.filter((report) => Boolean(report.blockers && report.blockers.trim())).length;
  const blockedTasks = tasks.filter((task) => task.status === "BLOCKED").length;
  const highPriorityTasks = tasks.filter((task) => task.priority === "HIGH" || task.priority === "CRITICAL").length;
  const runningLive = activeEntry?.liveState === "RUNNING";

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Field Operations"
          subtitle="Coordonare santier in timp real: prezenta, pontaj live, raportare progres, evidenta blocaje si dovada foto."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/pontaj" className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Pontaj complet
              </Link>
              <Link href="/calendar" className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Calendar echipe
              </Link>
              <Link href="/rapoarte-zilnice" className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]">
                Rapoarte zilnice
              </Link>
            </div>
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Taskuri active</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{tasks.length}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">lucrari deschise in zona ta</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Rapoarte cu blocaje</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{reportsWithBlockers}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">interventie prioritara</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Taskuri critice</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{highPriorityTasks}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">prioritate HIGH / CRITICAL</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Taskuri blocate</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{blockedTasks}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">status BLOCKED</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr_1fr]">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Shift Command</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Prezenta si pontaj live</h2>
            <div className="mt-3 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-xs text-[var(--muted)]">
              <p>Check-in: {attendance?.checkInAt ? formatDateTime(attendance.checkInAt) : "-"}</p>
              <p>Check-out: {attendance?.checkOutAt ? formatDateTime(attendance.checkOutAt) : "-"}</p>
            </div>

            <div className="mt-3 space-y-2">
              <form action={checkInOnSite} className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                <Input name="latitude" placeholder="Latitudine" className="h-11" />
                <Input name="longitude" placeholder="Longitudine" className="h-11" />
                <Button type="submit" className="h-11">Check-in</Button>
              </form>
              <form action={checkOutOnSite} className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                <Input name="latitude" placeholder="Latitudine" className="h-11" />
                <Input name="longitude" placeholder="Longitudine" className="h-11" />
                <Button type="submit" variant="secondary" className="h-11">Check-out</Button>
              </form>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Pontaj activ</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {activeEntry ? `${activeEntry.workOrder?.title || "General"}` : "Fara pontaj activ"}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {activeEntry ? `${activeEntry.project.title} • start ${formatDateTime(activeEntry.startAt)}` : "Porneste pontajul din Task Pulse"}
              </p>
              {activeEntry ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Badge tone={runningLive ? "success" : "warning"}>{activeEntry.liveState}</Badge>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {runningLive ? (
                      <form action={pauseLivePontaj}>
                        <input type="hidden" name="id" value={activeEntry.id} />
                        <Button size="sm" variant="secondary">Pauza</Button>
                      </form>
                    ) : (
                      <form action={resumeLivePontaj}>
                        <input type="hidden" name="id" value={activeEntry.id} />
                        <Button size="sm">Reia</Button>
                      </form>
                    )}
                    <form action={stopLivePontaj}>
                      <input type="hidden" name="id" value={activeEntry.id} />
                      <Button size="sm" variant="destructive">Stop</Button>
                    </form>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Field Update Composer</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Raport operational rapid</h2>
            {projects.length === 0 ? (
              <p className="mt-3 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                Nu exista proiecte disponibile in aria ta. Raportarea teren devine disponibila dupa alocare.
              </p>
            ) : null}
            <form action={createFieldUpdate} className="mt-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label>Proiect</label>
                  <select name="projectId" required>
                    <option value="">Selecteaza proiect</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.title}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label>Lucrare</label>
                  <select name="workOrderId" defaultValue="">
                    <option value="">Fara lucrare specifica</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>{task.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label>Conditii meteo</label>
                  <Input name="weather" placeholder="Ex: senin, vant puternic" />
                </div>
                <div className="space-y-1">
                  <label>Muncitori prezenti</label>
                  <Input name="workersCount" type="number" min={0} placeholder="0" defaultValue={0} />
                </div>
              </div>
              <div className="space-y-1">
                <label>Progres realizat</label>
                <Textarea name="progress" rows={3} required placeholder="Ce s-a realizat azi in santier" />
              </div>
              <div className="space-y-1">
                <label>Blocaje</label>
                <Textarea name="blockers" rows={2} placeholder="Probleme operationale, lipsa materiale, acces, securitate" />
              </div>
              <div className="space-y-1">
                <label>Observatii</label>
                <Textarea name="note" rows={2} placeholder="Informatii utile pentru PM / birou" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={projects.length === 0}>
                  {projects.length === 0 ? "Fara proiecte disponibile" : "Trimite update teren"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Task Pulse</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Actiuni rapide pe lucrari</h2>
            <div className="mt-3 space-y-3">
              {tasks.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Nu exista lucrari active pentru tine in acest moment.</p>
              ) : (
                tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{task.title}</p>
                        <p className="text-xs text-[var(--muted)]">{task.project.title}</p>
                      </div>
                      <Badge tone={task.status === "BLOCKED" ? "danger" : task.priority === "CRITICAL" ? "warning" : "neutral"}>
                        {task.priority}
                      </Badge>
                    </div>
                    <form action={startLivePontaj} className="mt-2 grid gap-2">
                      <input type="hidden" name="workOrderId" value={task.id} />
                      <input type="hidden" name="projectId" value={task.projectId} />
                      <Input name="note" placeholder="Nota start pontaj (optional)" className="h-10" />
                      <Button size="sm" className="h-10" disabled={Boolean(activeEntry)}>Start pontaj pe task</Button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Field Evidence</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Foto progres pe lucrari</h2>
            <div className="mt-3 space-y-3">
              {tasks.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista lucrari active pentru incarcare foto.
                </p>
              ) : null}
              {tasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-[var(--foreground)]">{task.title}</p>
                  <p className="text-xs text-[var(--muted)]">{task.project.title} • {task.status} • {task.priority}</p>

                  <form action={uploadTaskPhoto} className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="workOrderId" value={task.id} />
                    <input type="hidden" name="projectId" value={task.projectId} />
                    <input name="file" type="file" accept="image/*" className="h-10 w-full text-xs" required />
                    <Input name="note" placeholder="Descriere foto" className="h-10" />
                    <Button size="sm" variant="secondary" className="h-10">Incarca foto</Button>
                  </form>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Update Feed</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Ultimele rapoarte teren</h2>
            <div className="mt-3 space-y-2">
              {reports.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista rapoarte teren in istoricul curent.
                </p>
              ) : null}
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{report.project.title}</p>
                  <p className="text-xs text-[var(--muted)]">{formatDateTime(report.createdAt)} • {report.workOrder?.title || "General"}</p>
                  <p className="mt-1 text-sm text-[var(--muted-strong)]">{report.workCompleted}</p>
                  <p className="text-xs text-[var(--muted)]">Blocaje: {report.blockers || "-"}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
