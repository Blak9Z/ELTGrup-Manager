"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createTimeEntryAction } from "./actions";
import { initialActionState } from "@/src/lib/action-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type Option = { id: string; label: string };

export function PontajCreateForm({
  projects,
  workOrders,
  users,
}: {
  projects: Option[];
  workOrders: Option[];
  users: Option[];
}) {
  const [state, formAction, pending] = useActionState(createTimeEntryAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <select name="userId" className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
        <option value="">Angajat (implicit: utilizator curent)</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>{user.label}</option>
        ))}
      </select>
      <select name="projectId" className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm" required>
        <option value="">Proiect</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.label}</option>
        ))}
      </select>
      <select name="workOrderId" className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
        <option value="">Lucrare (optional)</option>
        {workOrders.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      <Input name="startDate" type="date" required />
      <Input name="startTime" type="time" required />
      <Input name="endDate" type="date" />
      <Input name="endTime" type="time" />
      <Input name="breakMinutes" type="number" placeholder="Pauza minute" defaultValue={0} />
      <Input name="note" placeholder="Observatii / geolocatie / blocaje" className="md:col-span-2 xl:col-span-4" />
      <p className="md:col-span-2 xl:col-span-4 text-xs text-[#9fb2cd]">
        Daca ora de final nu este completata, sistemul seteaza automat finalul la 17:00 in aceeasi zi.
      </p>
      <div className="flex justify-end xl:col-span-4">
        <Button type="submit" disabled={pending}>{pending ? "Se trimite..." : "Trimite pontaj"}</Button>
      </div>
    </form>
  );
}
