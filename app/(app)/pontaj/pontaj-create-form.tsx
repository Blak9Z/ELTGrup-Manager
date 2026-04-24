"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createTimeEntryAction } from "./actions";
import { initialActionState } from "@/src/lib/action-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type Option = { id: string; label: string; projectId?: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[#ffb4bd]">{message}</p>;
}

export function PontajCreateForm({
  projects,
  workOrders,
  users,
  canSelectUser,
}: {
  projects: Option[];
  workOrders: Option[];
  users: Option[];
  canSelectUser: boolean;
}) {
  const [state, formAction, pending] = useActionState(createTimeEntryAction, initialActionState);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");
  const scopedWorkOrders = useMemo(
    () => (selectedProjectId ? workOrders.filter((item) => item.projectId === selectedProjectId) : workOrders),
    [selectedProjectId, workOrders],
  );

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  const effectiveWorkOrderId = scopedWorkOrders.some((item) => item.id === selectedWorkOrderId) ? selectedWorkOrderId : "";

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Angajat</label>
          {canSelectUser ? (
            <select name="userId" className="h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm">
              <option value="">Implicit: utilizatorul curent</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
              Pontajul se inregistreaza pentru contul curent.
            </div>
          )}
          <FieldError message={state.errors?.userId?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Proiect</label>
          <select
            name="projectId"
            className="h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm"
            required
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            <option value="">Alege proiectul</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </select>
          <FieldError message={state.errors?.projectId?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Lucrare</label>
          <select
            name="workOrderId"
            className="h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm"
            value={effectiveWorkOrderId}
            onChange={(event) => setSelectedWorkOrderId(event.target.value)}
          >
            <option value="">Fara lucrare specifica</option>
            {scopedWorkOrders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {selectedProjectId && scopedWorkOrders.length === 0 ? (
            <p className="mt-1 text-xs text-[var(--muted)]">Nu exista lucrari active pentru proiectul selectat.</p>
          ) : null}
          <FieldError message={state.errors?.workOrderId?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Mod tura</label>
          <select name="shiftMode" defaultValue="STANDARD" className="h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm">
            <option value="STANDARD">Tura standard - final implicit la 17:00</option>
            <option value="CUSTOM">Tura custom - final obligatoriu</option>
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">Standard simplifica pontajul; custom se foloseste pentru intervale reale diferite.</p>
          <FieldError message={state.errors?.shiftMode?.[0]} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Data start</label>
          <Input name="startDate" type="date" required />
          <FieldError message={state.errors?.startDate?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Ora start</label>
          <Input name="startTime" type="time" required />
          <FieldError message={state.errors?.startTime?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Data final</label>
          <Input name="endDate" type="date" placeholder="Doar daca inchizi tura acum" />
          <FieldError message={state.errors?.endDate?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Ora final</label>
          <Input name="endTime" type="time" placeholder="Doar daca inchizi tura acum" />
          <FieldError message={state.errors?.endTime?.[0]} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] xl:grid-cols-[1fr_auto]">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Pauza minute</label>
          <Input name="breakMinutes" type="number" min={0} max={600} step={5} defaultValue={0} placeholder="0" />
          <FieldError message={state.errors?.breakMinutes?.[0]} />
        </div>
        <div className="flex items-end">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-xs text-[var(--muted)]">
            <p className="font-semibold text-[var(--muted-strong)]">Regula de tura</p>
            <p className="mt-1">Daca lasi finalul gol, sistemul inchide automat la 17:00 in aceeasi zi. Pentru tura personalizata, completeaza finalul explicit.</p>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Nota operationala</label>
        <Input name="note" placeholder="Observatii, blocaje, locatie, confirmari" />
        <FieldError message={state.errors?.note?.[0]} />
      </div>

      {state.message && !state.ok ? (
        <p className="rounded-xl border border-[rgba(190,95,111,0.46)] bg-[rgba(190,95,111,0.14)] px-3 py-2 text-sm text-[#f6c7cf]">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--muted)]">Statusurile finale sunt clare: in asteptare aprobare intra in verificare, aprobat merge in salarizare, respins ramane cu motivatia de respingere.</p>
        <Button type="submit" disabled={pending}>
          {pending ? "Se trimite..." : "Trimite pontaj"}
        </Button>
      </div>
    </form>
  );
}
