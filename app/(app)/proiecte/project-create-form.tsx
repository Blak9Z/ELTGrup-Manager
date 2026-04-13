"use client";

import { useActionState, useEffect } from "react";
import { ProjectStatus, ProjectType } from "@prisma/client";
import { toast } from "sonner";
import { createProjectAction } from "./actions";
import { initialActionState } from "@/src/lib/action-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type ClientOption = {
  id: string;
  name: string;
};

export function ProjectCreateForm({ clients }: { clients: ClientOption[] }) {
  const [state, formAction, pending] = useActionState(createProjectAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Input name="title" placeholder="Nume proiect" required />
      <select name="clientId" required>
        <option value="">Client</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>{client.name}</option>
        ))}
      </select>
      <select name="type" defaultValue={ProjectType.COMMERCIAL}>
        {Object.values(ProjectType).map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <select name="status" defaultValue={ProjectStatus.PLANNED}>
        {Object.values(ProjectStatus).map((status) => (
          <option key={status} value={status}>{status}</option>
        ))}
      </select>
      <Input name="siteAddress" placeholder="Adresa santier" required className="md:col-span-2" />
      <Input name="contractValue" placeholder="Valoare contract (RON)" type="number" required />
      <Input name="estimatedBudget" placeholder="Buget estimat (RON)" type="number" required />
      <Input name="startDate" type="date" />
      <Input name="endDate" type="date" />
      </div>
      <div className="md:col-span-2 xl:col-span-4 flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Se salveaza..." : "Creeaza proiect"}</Button>
      </div>
      {state.errors?.title ? <p className="md:col-span-2 xl:col-span-4 text-xs text-[#ffb4bd]">{state.errors.title[0]}</p> : null}
    </form>
  );
}
