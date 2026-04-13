"use client";

import { useActionState, useEffect } from "react";
import { CostType } from "@prisma/client";
import { toast } from "sonner";
import { createCostEntryAction } from "./actions";
import { initialActionState } from "@/src/lib/action-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type Option = { id: string; label: string };

export function CostEntryForm({ projects }: { projects: Option[] }) {
  const [state, formAction, pending] = useActionState(createCostEntryAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="mt-3 space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Cost Registration</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1">
          <label>Proiect</label>
          <select name="projectId" required>
            <option value="">Proiect</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label>Tip cost</label>
          <select name="type" defaultValue={CostType.OTHER}>
            {Object.values(CostType).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label>Descriere</label>
          <Input name="description" placeholder="Descriere" required />
        </div>
        <div className="space-y-1">
          <label>Suma</label>
          <Input name="amount" type="number" step="0.01" placeholder="Suma" required />
        </div>
        <div className="space-y-1">
          <label>Data</label>
          <Input name="occurredAt" type="date" required />
        </div>
      </div>
      <div className="flex justify-end md:col-span-2 xl:col-span-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salveaza..." : "Salveaza cost"}
        </Button>
      </div>
      {state.errors?.amount ? <p className="md:col-span-2 xl:col-span-5 text-xs text-[#ffb4bd]">{state.errors.amount[0]}</p> : null}
    </form>
  );
}
