import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope, workOrderScopeWhere } from "@/src/lib/access-scope";
import { prisma } from "@/src/lib/prisma";
import { createCalendarTaskAction } from "./actions";
import { PlanningBoard } from "./planning-board";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; teamId?: string; q?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const userContext = session?.user
    ? { id: session.user.id, email: session.user.email, roleKeys: session.user.roleKeys || [] }
    : { id: "", email: null, roleKeys: [] };

  const [projects, teams, workOrders] = await Promise.all([
    prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(scope.projectIds === null ? {} : { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } }),
      },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.team.findMany({
      where: scope.teamId ? { deletedAt: null, id: scope.teamId } : { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        ...workOrderScopeWhere(userContext, scope),
        status: { not: "CANCELED" },
        projectId:
          params.projectId && (scope.projectIds === null || scope.projectIds.includes(params.projectId))
            ? params.projectId
            : undefined,
        teamId: params.teamId && (!scope.teamId || scope.teamId === params.teamId) ? params.teamId : undefined,
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
        <PageHeader title="Calendar operational" subtitle="Planificare saptamanala cu detectie conflicte si reprogramare directa" />
        <Card>
          <form className="mb-4 grid gap-3 md:grid-cols-4">
            <Input name="q" placeholder="Cauta lucrare" defaultValue={params.q || ""} />
            <select name="projectId" defaultValue={params.projectId || ""}>
              <option value="">Toate proiectele</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <select name="teamId" defaultValue={params.teamId || ""}>
              <option value="">Toate echipele</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Filtreaza
            </Button>
          </form>

          <form action={createCalendarTaskAction} className="mb-5 grid gap-3 rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.8)] p-3 md:grid-cols-4">
            <Input name="title" placeholder="Adauga lucrare rapida in calendar" required />
            <select name="projectId" required defaultValue="">
              <option value="" disabled>
                Selecteaza proiect
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <select name="teamId" defaultValue="">
              <option value="">Fara echipa</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select name="dayLabel" defaultValue="Luni">
                {["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"].map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <Button type="submit" className="h-10">
                Adauga
              </Button>
            </div>
          </form>

          <PlanningBoard initialTasks={tasks} />
        </Card>
      </div>
    </PermissionGuard>
  );
}
