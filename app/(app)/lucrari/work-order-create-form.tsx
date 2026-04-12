"use client";

import { useActionState, useEffect } from "react";
import { TaskPriority, WorkOrderStatus } from "@prisma/client";
import { toast } from "sonner";
import { createWorkOrderAction } from "./actions";
import { initialActionState } from "@/src/lib/action-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";

type Option = { id: string; label: string };

export function WorkOrderCreateForm({
  projects,
  users,
  teams,
}: {
  projects: Option[];
  users: Option[];
  teams: Option[];
}) {
  const [state, formAction, pending] = useActionState(createWorkOrderAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Input name="title" required placeholder="Titlu lucrare" className="md:col-span-2" />
      <select name="projectId" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm" required>
        <option value="">Proiect</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.label}</option>
        ))}
      </select>
      <select name="teamId" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
        <option value="">Echipa</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>{team.label}</option>
        ))}
      </select>
      <select name="responsibleId" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
        <option value="">Responsabil</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>{user.label}</option>
        ))}
      </select>
      <Input name="startDate" type="date" />
      <Input name="dueDate" type="date" />
      <Input name="estimatedHours" type="number" placeholder="Ore estimate" />
      <select name="priority" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm" defaultValue={TaskPriority.MEDIUM}>
        {Object.values(TaskPriority).map((priority) => (
          <option key={priority} value={priority}>{priority}</option>
        ))}
      </select>
      <select name="status" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm" defaultValue={WorkOrderStatus.TODO}>
        {Object.values(WorkOrderStatus).map((status) => (
          <option key={status} value={status}>{status}</option>
        ))}
      </select>
      <div className="md:col-span-2 xl:col-span-4">
        <Textarea name="description" rows={3} placeholder="Descriere, checklist, dependinte, locatie exacta..." />
      </div>
      <div className="md:col-span-2 xl:col-span-4 flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Se salveaza..." : "Adauga lucrare"}</Button>
      </div>
    </form>
  );
}
