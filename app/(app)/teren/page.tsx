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
      include: { project: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.timeEntry.findFirst({
      where: {
        userId: session?.user?.id,
        endAt: null,
        liveState: { in: ["RUNNING", "PAUSED"] },
      },
      include: { project: true, workOrder: true },
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
      include: { project: true, workOrder: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);
  const reportsWithBlockers = reports.filter((report) => Boolean(report.blockers && report.blockers.trim())).length;

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Teren" subtitle="Update-uri santier, progres zilnic, blocaje, foto si raportare rapida" />

        <section className="grid gap-3 md:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-[0.08em] text-[#9fb2cd]">Taskuri active in aria ta</p>
            <p className="mt-2 text-2xl font-black text-[#edf4ff]">{tasks.length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-[0.08em] text-[#9fb2cd]">Rapoarte cu blocaje</p>
            <p className="mt-2 text-2xl font-black text-[#edf4ff]">{reportsWithBlockers}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-[0.08em] text-[#9fb2cd]">Stare pontaj live</p>
            <p className="mt-2 text-sm font-semibold text-[#edf4ff]">{activeEntry ? `${activeEntry.liveState} (${activeEntry.project.title})` : "Fara pontaj activ"}</p>
            <Link href="/pontaj" className="mt-2 inline-block text-xs font-semibold text-[#c6dbff] hover:underline">
              Deschide pontaj complet
            </Link>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h2 className="text-lg font-semibold text-[#edf4ff]">Raport rapid din teren</h2>
            <form action={createFieldUpdate} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <select name="projectId" required>
                <option value="">Selecteaza proiect</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
              <select name="workOrderId" defaultValue="">
                <option value="">Fara lucrare specifica</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
              <Input name="weather" placeholder="Vreme" />
              <Input name="workersCount" type="number" min={0} placeholder="Muncitori prezenti" defaultValue={0} />
              <div className="md:col-span-2 xl:col-span-4">
                <Textarea name="progress" rows={2} required placeholder="Ce s-a realizat azi in santier" />
              </div>
              <Textarea name="blockers" rows={2} placeholder="Blocaje / probleme" className="md:col-span-2" />
              <Textarea name="note" rows={2} placeholder="Observatii suplimentare" className="md:col-span-2" />
              <div className="md:col-span-2 xl:col-span-4 flex justify-end">
                <Button type="submit">Trimite update teren</Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[#edf4ff]">Prezenta + pontaj live</h2>
            <div className="mt-2 text-xs text-[#9fb2cd]">
              <p>Check-in: {attendance?.checkInAt ? formatDateTime(attendance.checkInAt) : "-"}</p>
              <p>Check-out: {attendance?.checkOutAt ? formatDateTime(attendance.checkOutAt) : "-"}</p>
            </div>
            <div className="mt-3 space-y-2">
              <form action={checkInOnSite} className="grid grid-cols-3 gap-2">
                <Input name="latitude" placeholder="Lat" className="h-11" />
                <Input name="longitude" placeholder="Long" className="h-11" />
                <Button type="submit" className="h-11">Check-in</Button>
              </form>
              <form action={checkOutOnSite} className="grid grid-cols-3 gap-2">
                <Input name="latitude" placeholder="Lat" className="h-11" />
                <Input name="longitude" placeholder="Long" className="h-11" />
                <Button type="submit" variant="secondary" className="h-11">Check-out</Button>
              </form>
            </div>

            {activeEntry ? (
              <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)] p-3">
                <p className="text-sm font-semibold text-[#edf4ff]">Pontaj activ: {activeEntry.workOrder?.title || "General"}</p>
                <p className="text-xs text-[#9fb2cd]">{activeEntry.project.title} • start {formatDateTime(activeEntry.startAt)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <Badge tone={activeEntry.liveState === "RUNNING" ? "success" : "warning"}>{activeEntry.liveState}</Badge>
                  <div className="flex gap-2">
                    {activeEntry.liveState === "RUNNING" ? (
                      <form action={pauseLivePontaj}><input type="hidden" name="id" value={activeEntry.id} /><Button size="sm" variant="secondary">Pauza</Button></form>
                    ) : (
                      <form action={resumeLivePontaj}><input type="hidden" name="id" value={activeEntry.id} /><Button size="sm">Reia</Button></form>
                    )}
                    <form action={stopLivePontaj}><input type="hidden" name="id" value={activeEntry.id} /><Button size="sm" variant="destructive">Stop</Button></form>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[#edf4ff]">Taskuri curente + foto progres</h2>
            <div className="mt-3 space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)] p-3">
                  <p className="font-semibold text-[#edf4ff]">{task.title}</p>
                  <p className="text-xs text-[#9fb2cd]">{task.project.title} • {task.status} • {task.priority}</p>

                  <form action={startLivePontaj} className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                    <input type="hidden" name="workOrderId" value={task.id} />
                    <input type="hidden" name="projectId" value={task.projectId} />
                    <Input name="note" placeholder="Nota start pontaj" className="h-10" />
                    <Button size="sm" className="h-10" disabled={Boolean(activeEntry)}>Start pontaj</Button>
                  </form>

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
            <h2 className="text-lg font-semibold text-[#edf4ff]">Ultimele update-uri transmise</h2>
            <div className="mt-3 space-y-2">
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)] p-3">
                  <p className="text-sm font-semibold text-[#edf4ff]">{report.project.title}</p>
                  <p className="text-xs text-[#9fb2cd]">{formatDateTime(report.createdAt)} • {report.workOrder?.title || "General"}</p>
                  <p className="mt-1 text-sm text-[#dbe8fb]">{report.workCompleted}</p>
                  <p className="text-xs text-[#9fb2cd]">Blocaje: {report.blockers || "-"}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
