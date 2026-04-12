import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { prisma } from "@/src/lib/prisma";
import { PlanningBoard } from "./planning-board";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; teamId?: string; q?: string }>;
}) {
  const params = await searchParams;

  const [projects, teams, workOrders] = await Promise.all([
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.team.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        status: { not: "CANCELED" },
        projectId: params.projectId || undefined,
        teamId: params.teamId || undefined,
        title: params.q ? { contains: params.q, mode: "insensitive" } : undefined,
      },
      include: { project: true, team: true },
      orderBy: { startDate: "asc" },
      take: 120,
    }),
  ]);

  const weekday = ["Duminica", "Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata"];
  const tasks = workOrders.map((workOrder) => ({
    id: workOrder.id,
    title: workOrder.title,
    project: workOrder.project.title,
    team: workOrder.team?.name || "Nealocata",
    status: workOrder.status,
    priority: workOrder.priority,
    day: workOrder.startDate ? weekday[workOrder.startDate.getDay()] : "Luni",
    startDateIso: workOrder.startDate?.toISOString() ?? null,
  }));

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Calendar / Planning Board"
          subtitle="Planificare zilnica/saptamanala cu detectie conflicte si rescheduling persistat"
        />
        <Card>
          <form className="mb-3 grid gap-3 md:grid-cols-4">
            <Input name="q" placeholder="Cauta lucrare" defaultValue={params.q || ""} />
            <select name="projectId" defaultValue={params.projectId || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
              <option value="">Toate proiectele</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
            <select name="teamId" defaultValue={params.teamId || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
              <option value="">Toate echipele</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg border border-[#cfddd3] bg-white px-3 text-sm font-semibold text-[#2d4335]">Filtreaza</button>
          </form>

          <PlanningBoard initialTasks={tasks} />
        </Card>
      </div>
    </PermissionGuard>
  );
}
