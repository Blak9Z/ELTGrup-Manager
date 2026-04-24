"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createDailyReportAction } from "./actions";
import { initialActionState } from "@/src/lib/action-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";

type Option = { id: string; label: string; projectId?: string };

export function DailyReportCreateForm({
  projects,
  workOrders,
  defaultProjectId,
  defaultWorkOrderId,
}: {
  projects: Option[];
  workOrders: Option[];
  defaultProjectId?: string;
  defaultWorkOrderId?: string;
}) {
  const [state, formAction, pending] = useActionState(createDailyReportAction, initialActionState);
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || "");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(defaultWorkOrderId || "");
  const scopedWorkOrders = useMemo(
    () => (selectedProjectId ? workOrders.filter((item) => item.projectId === selectedProjectId) : workOrders),
    [selectedProjectId, workOrders],
  );

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  const effectiveWorkOrderId = scopedWorkOrders.some((workOrder) => workOrder.id === selectedWorkOrderId)
    ? selectedWorkOrderId
    : "";

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <select
        name="projectId"
        required
        value={selectedProjectId}
        onChange={(event) => setSelectedProjectId(event.target.value)}
        className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm"
      >
        <option value="">Proiect</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.label}</option>
        ))}
      </select>
      <select
        name="workOrderId"
        value={effectiveWorkOrderId}
        onChange={(event) => setSelectedWorkOrderId(event.target.value)}
        className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm"
      >
        <option value="">Lucrare (optional)</option>
        {scopedWorkOrders.map((workOrder) => (
          <option key={workOrder.id} value={workOrder.id}>{workOrder.label}</option>
        ))}
      </select>
      {selectedProjectId && scopedWorkOrders.length === 0 ? (
        <p className="md:col-span-2 xl:col-span-4 text-xs text-[var(--muted)]">
          Nu exista lucrari disponibile pentru proiectul selectat.
        </p>
      ) : null}
      <Input name="reportDate" type="date" required />
      <Input name="weather" placeholder="Vreme" />
      <div>
        <Input name="workersCount" type="number" min={0} defaultValue={0} placeholder="Numar muncitori" />
        {state.errors?.workersCount ? <p className="mt-1 text-xs text-[#ffb4bd]">{state.errors.workersCount[0]}</p> : null}
      </div>
      <Input name="subcontractorsPresent" placeholder="Subcontractori prezenti" />
      <Input name="materialsReceived" placeholder="Materiale primite" />
      <Input name="equipmentUsed" placeholder="Echipamente utilizate" />
      <div className="md:col-span-2 xl:col-span-4"><Textarea name="workCompleted" rows={2} required placeholder="Lucrari finalizate azi" /></div>
      <div className="md:col-span-2 xl:col-span-2"><Textarea name="blockers" rows={2} placeholder="Blocaje / intarzieri" /></div>
      <div className="md:col-span-2 xl:col-span-2"><Textarea name="safetyIncidents" rows={2} placeholder="Incidente SSM" /></div>
      <Input name="signatures" placeholder="Semnaturi" className="md:col-span-2" />
      <Input name="photos" placeholder="Lista foto (URL-uri separate cu virgula)" className="md:col-span-2" />
      <div className="md:col-span-2 xl:col-span-4 flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Se salveaza..." : "Salveaza raport"}</Button>
      </div>
      {state.errors?.workCompleted ? <p className="md:col-span-2 xl:col-span-4 text-xs text-[#ffb4bd]">{state.errors.workCompleted[0]}</p> : null}
    </form>
  );
}
