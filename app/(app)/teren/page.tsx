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
import { cn, formatDateTime } from "@/src/lib/utils";
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
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
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
      orderBy: [{ startAt: "desc" }, { id: "asc" }],
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
      orderBy: [{ title: "asc" }, { id: "asc" }],
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
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
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
          title="Operatiuni teren"
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
            <p className="mt-1 text-xs text-[var(--muted)]">prioritate ridicata sau critica</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Taskuri blocate</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{blockedTasks}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">status blocat</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr_1fr]">
          <Card className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Prezenta si tura</p>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Pontaj Rapid</h2>
              <p className="text-sm leading-relaxed text-[var(--muted)]">Check-in marcheaza prezenta la santier. Pontajul live se gestioneaza separat.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-2xl bg-[rgba(13,20,30,0.5)] p-4 shadow-inner">
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Check-in</p>
                <p className="font-mono text-xs font-semibold text-[var(--foreground)]">{attendance?.checkInAt ? formatDateTime(attendance.checkInAt) : "--:--"}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Check-out</p>
                <p className="font-mono text-xs font-semibold text-[var(--foreground)]">{attendance?.checkOutAt ? formatDateTime(attendance.checkOutAt) : "--:--"}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <form action={checkInOnSite} className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input name="latitude" placeholder="Latitudine GPS" className="h-12 bg-[var(--surface)] text-sm" />
                  <Input name="longitude" placeholder="Longitudine GPS" className="h-12 bg-[var(--surface)] text-sm" />
                </div>
                <Button type="submit" className="h-14 w-full text-base font-bold shadow-lg shadow-[#426990]/20 active:scale-[0.98]">Check-in santier</Button>
              </form>
              <form action={checkOutOnSite} className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input name="latitude" placeholder="Latitudine GPS" className="h-12 bg-[var(--surface)] text-sm" />
                  <Input name="longitude" placeholder="Longitudine GPS" className="h-12 bg-[var(--surface)] text-sm" />
                </div>
                <Button type="submit" variant="secondary" className="h-14 w-full text-base font-bold active:scale-[0.98]">Check-out santier</Button>
              </form>
            </div>

            <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(30,44,61,0.4),rgba(20,32,46,0.4))] p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--border)]/30 pb-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Tura Activa</p>
                <Badge tone={runningLive ? "success" : "warning"} className="px-3 py-1 text-[10px] font-bold">{runningLive ? "LIVE" : "PAUZĂ"}</Badge>
              </div>
              
              <div className="flex flex-col gap-1">
                <p className="text-base font-bold text-[var(--foreground)] truncate">
                  {activeEntry ? activeEntry.workOrder?.title || "General" : "Niciun pontaj activ"}
                </p>
                <p className="text-xs text-[var(--muted)] truncate">
                  {activeEntry ? `${activeEntry.project.title}` : "Porneste lucrul dintr-un task."}
                </p>
                {activeEntry && <p className="mt-1 font-mono text-[11px] text-[#8dc1f5]">Start: {formatDateTime(activeEntry.startAt)}</p>}
              </div>

              {activeEntry && (
                <div className="mt-2 grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    {runningLive ? (
                      <form action={pauseLivePontaj} className="w-full">
                        <input type="hidden" name="id" value={activeEntry.id} />
                        <Button variant="secondary" className="h-12 w-full font-bold">Pauză</Button>
                      </form>
                    ) : (
                      <form action={resumeLivePontaj} className="w-full">
                        <input type="hidden" name="id" value={activeEntry.id} />
                        <Button className="h-12 w-full font-bold">Reia</Button>
                      </form>
                    )}
                    <form action={stopLivePontaj} className="w-full">
                      <input type="hidden" name="id" value={activeEntry.id} />
                      <Button variant="destructive" className="h-12 w-full font-bold">Stop</Button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Raport zilnic</p>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Raport Teren</h2>
              <p className="text-sm leading-relaxed text-[var(--muted)]">Trimite progresul și blochează riscurile direct din teren.</p>
            </div>

            <form action={createFieldUpdate} className="flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Proiect</p>
                  <select name="projectId" required className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium focus:border-[var(--border-strong)] focus:outline-none">
                    <option value="">Alege Proiect</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.title}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Front de Lucru</p>
                  <select name="workOrderId" defaultValue="" className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium focus:border-[var(--border-strong)] focus:outline-none">
                    <option value="">General (Fără Task)</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>{task.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Realizări Azi</p>
                <Textarea name="progress" rows={3} required placeholder="Ex: Montaj finalizat sector A..." className="bg-[var(--surface)] p-4 text-sm leading-relaxed" />
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Blocaje / Nevoi</p>
                <Textarea name="blockers" rows={2} placeholder="Ex: Lipsă material X, acces blocat..." className="bg-[var(--surface)] p-4 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Vreme</p>
                  <Input name="weather" placeholder="Ex: Senin" className="h-12 bg-[var(--surface)]" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Muncitori</p>
                  <Input name="workersCount" type="number" min={0} defaultValue={0} className="h-12 bg-[var(--surface)]" />
                </div>
              </div>

              <Button type="submit" className="h-14 w-full text-base font-bold shadow-lg shadow-[#426990]/20 active:scale-[0.98]" disabled={projects.length === 0}>
                {projects.length === 0 ? "Fără Proiecte" : "Trimite Raport"}
              </Button>
            </form>
          </Card>

          <Card className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Lucrari active</p>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Task-uri Azi</h2>
            </div>
            
            <div className="flex flex-col gap-4">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] py-12 text-center">
                  <p className="text-sm font-medium text-[var(--muted)]">Nicio lucrare activă atribuită.</p>
                </div>
              ) : (
                tasks.slice(0, 10).map((task) => (
                  <div key={task.id} className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(21,33,48,0.3),rgba(15,25,37,0.3))] p-5 transition-all active:bg-[var(--surface-2)]">
                    <div className="flex items-start justify-between gap-3 border-b border-[var(--border)]/30 pb-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-[var(--foreground)]">{task.title}</p>
                        <p className="mt-0.5 truncate text-xs font-medium text-[#9fb9d7]">{task.project.title}</p>
                      </div>
                      <Badge tone={task.status === "BLOCKED" ? "danger" : task.priority === "CRITICAL" ? "warning" : "neutral"} className="shrink-0 font-bold uppercase text-[9px]">
                        {task.priority}
                      </Badge>
                    </div>

                    <form action={startLivePontaj} className="flex flex-col gap-3">
                      <input type="hidden" name="workOrderId" value={task.id} />
                      <input type="hidden" name="projectId" value={task.projectId} />
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Notă Activitate (opțional)</p>
                        <Input name="note" placeholder="Ce urmează să faci?" className="h-11 bg-[var(--surface)] text-sm" />
                      </div>
                      <Button 
                        size="lg" 
                        className="h-12 w-full font-bold shadow-md shadow-[#426990]/10 active:scale-[0.98]" 
                        disabled={Boolean(activeEntry)}
                      >
                        {activeEntry ? "Pontaj deja activ" : "Începe Lucrul"}
                      </Button>
                    </form>
                    
                    <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--muted)]">
                      <div className={cn("h-1.5 w-1.5 rounded-full", task.status === "BLOCKED" ? "bg-red-400" : task.status === "IN_PROGRESS" ? "bg-blue-400" : "bg-gray-400")} />
                      <span>Stare: {task.status === "BLOCKED" ? "Blocat" : task.status === "IN_PROGRESS" ? "In Lucru" : "Planificat"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Dovezi de teren</p>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Foto & Semnătură</h2>
            </div>
            
            <div className="flex flex-col gap-6">
              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
                  Nicio lucrare activă pentru probe.
                </div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(21,33,48,0.3),rgba(15,25,37,0.3))] p-5">
                    <div className="flex flex-col gap-1 border-b border-[var(--border)]/30 pb-3">
                      <p className="font-bold text-[var(--foreground)]">{task.title}</p>
                      <p className="text-xs font-medium text-[#9fb9d7]">{task.project.title}</p>
                    </div>

                    <div className="flex flex-col gap-6">
                      <form action={uploadTaskPhoto} encType="multipart/form-data" className="flex flex-col gap-3">
                        <input type="hidden" name="workOrderId" value={task.id} />
                        <input type="hidden" name="projectId" value={task.projectId} />
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Foto Progres</p>
                          <input name="file" type="file" accept="image/*" capture="environment" className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--muted-strong)]" required />
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <Input name="note" placeholder="Descriere scurtă..." className="h-11 bg-[var(--surface)]" />
                          <Button size="sm" variant="secondary" className="h-11 px-4 font-bold">Încarcă</Button>
                        </div>
                      </form>

                      <div className="h-px bg-[var(--border)]/30" />

                      <form action={uploadTaskSignature} encType="multipart/form-data" className="flex flex-col gap-3">
                        <input type="hidden" name="workOrderId" value={task.id} />
                        <input type="hidden" name="projectId" value={task.projectId} />
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Semnătură / PV</p>
                          <input name="file" type="file" accept="image/*,application/pdf" className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--muted-strong)]" required />
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <Input name="note" placeholder="Nume semnatar..." className="h-11 bg-[var(--surface)]" />
                          <Button size="sm" className="h-11 px-4 font-bold">Încarcă</Button>
                        </div>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Istoric rapoarte</p>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Ultimele Actualizări</h2>
            </div>
            <div className="flex flex-col gap-3">
              {reports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
                  Nu există rapoarte recente.
                </div>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(13,20,30,0.4),rgba(10,17,25,0.4))] p-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[var(--border)]/30 pb-2">
                      <p className="truncate text-sm font-bold text-[var(--foreground)]">{report.project.title}</p>
                      <p className="shrink-0 font-mono text-[10px] text-[#8dc1f5]">{formatDateTime(report.createdAt)}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs leading-relaxed text-[var(--muted-strong)] line-clamp-2">{report.workCompleted}</p>
                      {report.blockers && (
                        <div className="flex items-start gap-2 rounded-lg bg-[rgba(170,66,83,0.1)] p-2">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                          <p className="text-[11px] font-medium text-red-200 line-clamp-2">Blocaje: {report.blockers}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-medium text-[var(--muted)] italic">{report.workOrder?.title || "Activitate Generală"}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
