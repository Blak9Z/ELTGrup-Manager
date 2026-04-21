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
  uploadTaskSignature,
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
          subtitle="Prezenta, pontaj live, raportare zilnica, fotografii si semnaturi - tot ce trebuie pentru o zi clara pe santier."
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
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Prezenta si tura</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Check-in, check-out si pontaj live</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Check-in/check-out marcheaza prezenta la santier. Pontajul live se gestioneaza separat, din acelasi panou.</p>

            <div className="mt-3 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-xs text-[var(--muted)]">
              <p>Check-in: {attendance?.checkInAt ? formatDateTime(attendance.checkInAt) : "-"}</p>
              <p>Check-out: {attendance?.checkOutAt ? formatDateTime(attendance.checkOutAt) : "-"}</p>
            </div>

            <div className="mt-3 space-y-3">
              <form action={checkInOnSite} className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                <Input name="latitude" placeholder="Latitudine GPS (optional)" className="h-11" />
                <Input name="longitude" placeholder="Longitudine GPS (optional)" className="h-11" />
                <Button type="submit" className="h-11">Check-in santier</Button>
              </form>
              <form action={checkOutOnSite} className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                <Input name="latitude" placeholder="Latitudine GPS (optional)" className="h-11" />
                <Input name="longitude" placeholder="Longitudine GPS (optional)" className="h-11" />
                <Button type="submit" variant="secondary" className="h-11">Check-out santier</Button>
              </form>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Pontaj activ</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {activeEntry ? activeEntry.workOrder?.title || "General" : "Fara pontaj activ"}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {activeEntry ? `${activeEntry.project.title} • start ${formatDateTime(activeEntry.startAt)}` : "Porneste tura din lista de lucrari active."}
              </p>
              {activeEntry ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Badge tone={runningLive ? "success" : "warning"}>{runningLive ? "RUNNING" : "PAUSED"}</Badge>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {runningLive ? (
                      <form action={pauseLivePontaj}>
                        <input type="hidden" name="id" value={activeEntry.id} />
                        <Button size="sm" variant="secondary">Pauza tura</Button>
                      </form>
                    ) : (
                      <form action={resumeLivePontaj}>
                        <input type="hidden" name="id" value={activeEntry.id} />
                        <Button size="sm">Reia tura</Button>
                      </form>
                    )}
                    <form action={stopLivePontaj}>
                      <input type="hidden" name="id" value={activeEntry.id} />
                      <Button size="sm" variant="destructive">Inchide tura</Button>
                    </form>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Raport zilnic</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Completeaza progresul de teren</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Prioritizeaza ce s-a facut azi, ce blocheaza echipa si ce are nevoie de follow-up. Acesta este raportul care merge mai departe la PM/birou.
            </p>
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
                    <option value="">Selecteaza proiectul</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label>Lucrare / front de lucru</label>
                  <select name="workOrderId" defaultValue="">
                    <option value="">Fara lucrare specifica</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label>Progres realizat azi</label>
                <Textarea name="progress" rows={3} required placeholder="Ex: montaj finalizat pe sectorul A, testare inceputa pe sectorul B" />
              </div>
              <div className="space-y-1">
                <label>Blocaje / riscuri</label>
                <Textarea name="blockers" rows={2} placeholder="Ex: lipsa material, acces limitat, vreme, asteptare aviz" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label>Vreme</label>
                  <Input name="weather" placeholder="Ex: senin, vant puternic, ploaie" />
                </div>
                <div className="space-y-1">
                  <label>Muncitori prezenti</label>
                  <Input name="workersCount" type="number" min={0} placeholder="0" defaultValue={0} />
                </div>
              </div>
              <div className="space-y-1">
                <label>Observatii pentru birou</label>
                <Textarea name="note" rows={2} placeholder="Ce trebuie urmarit maine, cine confirma, ce documente lipsesc" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={projects.length === 0}>
                  {projects.length === 0 ? "Fara proiecte disponibile" : "Trimite raport de teren"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Lucrari active</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Porneste lucrul pe frontul corect</h2>
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
                      <Badge tone={task.status === "BLOCKED" ? "danger" : task.priority === "CRITICAL" ? "warning" : "neutral"}>{task.priority}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Stare: {task.status === "BLOCKED" ? "blocat" : task.status === "IN_PROGRESS" ? "in lucru" : "de pornit"}
                    </p>
                    <form action={startLivePontaj} className="mt-2 grid gap-2">
                      <input type="hidden" name="workOrderId" value={task.id} />
                      <input type="hidden" name="projectId" value={task.projectId} />
                      <Input name="note" placeholder="Nota de start tura (optional)" className="h-10" />
                      <Button size="sm" className="h-10" disabled={Boolean(activeEntry)}>
                        {activeEntry ? "Tura live deja pornita" : "Porneste tura pe lucrare"}
                      </Button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Dovezi de teren</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Foto progres si semnatura de predare</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Incarca fotografia de progres si, unde e cazul, semnatura sau documentul de predare. Completeaza nota pentru contextul operatiunii.</p>
            <div className="mt-3 space-y-3">
              {tasks.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista lucrari active pentru incarcare foto.
                </p>
              ) : null}
              {tasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-[var(--foreground)]">{task.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {task.project.title} • {task.status} • {task.priority}
                  </p>

                  <div className="mt-2 grid gap-2">
                    <form action={uploadTaskPhoto} encType="multipart/form-data" className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <input type="hidden" name="workOrderId" value={task.id} />
                      <input type="hidden" name="projectId" value={task.projectId} />
                      <input name="file" type="file" accept="image/*" className="h-10 w-full text-xs" required />
                      <Input name="note" placeholder="Descriere foto progres" className="h-10" />
                      <Button size="sm" variant="secondary" className="h-10">Incarca foto</Button>
                    </form>

                    <form action={uploadTaskSignature} encType="multipart/form-data" className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <input type="hidden" name="workOrderId" value={task.id} />
                      <input type="hidden" name="projectId" value={task.projectId} />
                      <input name="file" type="file" accept="image/*,application/pdf" className="h-10 w-full text-xs" required />
                      <Input name="note" placeholder="Semnatura client / PV predare" className="h-10" />
                      <Button size="sm" className="h-10">Incarca semnatura</Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Istoric rapoarte</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Ultimele rapoarte teren</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Vezi rapid ce a fost raportat, unde exista blocaje si ce trebuie preluat mai departe.</p>
            <div className="mt-3 space-y-2">
              {reports.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista rapoarte teren in istoricul curent.
                </p>
              ) : null}
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{report.project.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatDateTime(report.createdAt)} • {report.workOrder?.title || "General"}
                  </p>
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
