import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { formatDateTime } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import {
  checkInOnSite,
  checkOutOnSite,
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

  const [tasks, activeEntry, attendance] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        responsibleId: session?.user?.id,
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
  ]);

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Mod teren (mobil)" subtitle="Taskuri de azi, pontaj live, check-in/out GPS, foto si semnatura persistente" />

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Prezenta astazi</p>
              <p className="text-xs text-[#4d6456]">Check-in: {attendance?.checkInAt ? formatDateTime(attendance.checkInAt) : "-"}</p>
              <p className="text-xs text-[#4d6456]">Check-out: {attendance?.checkOutAt ? formatDateTime(attendance.checkOutAt) : "-"}</p>
            </div>
            <div className="flex gap-2">
              <form action={checkInOnSite} className="flex items-center gap-2">
                <Input name="latitude" placeholder="Lat" className="h-9 w-24" />
                <Input name="longitude" placeholder="Long" className="h-9 w-24" />
                <Button type="submit" size="sm">Check-in</Button>
              </form>
              <form action={checkOutOnSite} className="flex items-center gap-2">
                <Input name="latitude" placeholder="Lat" className="h-9 w-24" />
                <Input name="longitude" placeholder="Long" className="h-9 w-24" />
                <Button type="submit" size="sm" variant="secondary">Check-out</Button>
              </form>
            </div>
          </div>
        </Card>

        {activeEntry ? (
          <Card className="border-[#b8d8c5] bg-[#eef8f2]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">Pontaj live activ: {activeEntry.workOrder?.title || "Fara lucrare"}</p>
                <p className="text-xs text-[#4d6456]">{activeEntry.project.title} • Start {formatDateTime(activeEntry.startAt)}</p>
                <p className="text-xs text-[#4d6456]">Pauza acumulata: {activeEntry.pauseAccumulatedMinutes} min</p>
              </div>
              <Badge tone={activeEntry.liveState === "RUNNING" ? "success" : "warning"}>{activeEntry.liveState}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeEntry.liveState === "RUNNING" ? (
                <form action={pauseLivePontaj}>
                  <input type="hidden" name="id" value={activeEntry.id} />
                  <Button type="submit" variant="secondary">Pauza</Button>
                </form>
              ) : (
                <form action={resumeLivePontaj}>
                  <input type="hidden" name="id" value={activeEntry.id} />
                  <Button type="submit">Reia</Button>
                </form>
              )}
              <form action={stopLivePontaj}>
                <input type="hidden" name="id" value={activeEntry.id} />
                <Button type="submit" variant="destructive">Stop + trimite</Button>
              </form>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Card key={task.id} className="p-4">
              <p className="text-sm font-bold">{task.title}</p>
              <p className="mt-1 text-xs text-[#607367]">{task.project.title}</p>
              <p className="mt-1 text-xs text-[#607367]">Locatie: {task.siteLocation || "Zona santier"}</p>
              <div className="mt-2 flex items-center justify-between">
                <Badge tone={task.status === "BLOCKED" ? "danger" : task.status === "IN_PROGRESS" ? "info" : "neutral"}>{task.status}</Badge>
                <span className="text-xs text-[#607367]">Prioritate {task.priority}</span>
              </div>

              <form action={startLivePontaj} className="mt-3 space-y-2">
                <input type="hidden" name="workOrderId" value={task.id} />
                <input type="hidden" name="projectId" value={task.projectId} />
                <Input name="note" placeholder="Nota start pontaj" />
                <Button size="sm" className="w-full" disabled={Boolean(activeEntry)}>Start pontaj live</Button>
              </form>

              <form action={uploadTaskPhoto} className="mt-3 space-y-2" encType="multipart/form-data">
                <input type="hidden" name="workOrderId" value={task.id} />
                <input type="hidden" name="projectId" value={task.projectId} />
                <input name="file" type="file" accept="image/*" className="w-full text-xs" required />
                <Input name="note" placeholder="Nota foto" />
                <Button size="sm" variant="secondary" className="w-full">Incarca foto</Button>
              </form>

              <form action={uploadTaskSignature} className="mt-3 space-y-2" encType="multipart/form-data">
                <input type="hidden" name="workOrderId" value={task.id} />
                <input type="hidden" name="projectId" value={task.projectId} />
                <input name="file" type="file" accept="image/*" className="w-full text-xs" required />
                <Input name="note" placeholder="Nota semnatura" />
                <Button size="sm" variant="secondary" className="w-full">Incarca semnatura</Button>
              </form>
            </Card>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}
