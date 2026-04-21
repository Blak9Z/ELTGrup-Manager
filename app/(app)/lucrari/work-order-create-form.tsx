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

type WorkloadMap = Record<string, number>;

type SelectOption = {
  value: string;
  label: string;
  help: string;
};

const priorityOptions: SelectOption[] = [
  { value: TaskPriority.LOW, label: "Scazuta", help: "Se poate programa dupa lucrarile urgente." },
  { value: TaskPriority.MEDIUM, label: "Medie", help: "Nivel standard pentru executie." },
  { value: TaskPriority.HIGH, label: "Ridicata", help: "Necesita atentie si reactie rapida." },
  { value: TaskPriority.CRITICAL, label: "Critica", help: "Blocheaza livrarea sau un front important." },
];

const statusOptions: SelectOption[] = [
  { value: WorkOrderStatus.TODO, label: "De facut", help: "Lucrarea este planificata, dar nu a inceput." },
  { value: WorkOrderStatus.IN_PROGRESS, label: "In lucru", help: "Se executa in prezent." },
  { value: WorkOrderStatus.BLOCKED, label: "Blocat", help: "Exista o dependinta sau o problema." },
  { value: WorkOrderStatus.REVIEW, label: "In verificare", help: "Asteapta control sau aprobare." },
  { value: WorkOrderStatus.DONE, label: "Finalizat", help: "A fost inchisa si predata." },
  { value: WorkOrderStatus.CANCELED, label: "Anulat", help: "Nu mai trebuie executata." },
];

function FieldError({ message }: { message?: string[] }) {
  if (!message?.length) return null;
  return <p className="text-xs text-[#ffb4bd]">{message[0]}</p>;
}

function formatLoad(count?: number) {
  if (!count) return "Disponibil";
  if (count === 1) return "1 lucrare activa";
  return `${count} lucrari active`;
}

function SelectField({
  label,
  help,
  name,
  required,
  defaultValue,
  options,
  error,
  hint,
}: {
  label: string;
  help: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  options: SelectOption[];
  error?: string[];
  hint?: string;
}) {
  return (
    <label>
      <span className="block text-sm font-semibold text-[var(--foreground)]">{label}</span>
      <span className="mt-1 block text-xs text-[var(--muted)]">{help}</span>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="mt-2 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[rgba(95,142,193,0.2)]"
      >
        {required ? <option value="">Alege...</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      <FieldError message={error} />
    </label>
  );
}

export function WorkOrderCreateForm({
  projects,
  users,
  teams,
  responsibleWorkloadById,
  teamWorkloadById,
}: {
  projects: Option[];
  users: Option[];
  teams: Option[];
  responsibleWorkloadById?: WorkloadMap;
  teamWorkloadById?: WorkloadMap;
}) {
  const [state, formAction, pending] = useActionState(createWorkOrderAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="md:col-span-2">
          <span className="block text-sm font-semibold text-[var(--foreground)]">Titlu lucrare</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Numele scurt folosit in lista, notificari si agenda.</span>
          <Input name="title" required placeholder="De exemplu: Montaj tabla acoperis" className="mt-2" />
          <FieldError message={state.errors?.title} />
        </label>

        <SelectField
          label="Proiect"
          help="Lucrarea va fi asociata proiectului selectat."
          name="projectId"
          required
          options={projects.map((project) => ({ value: project.id, label: project.label, help: "" }))}
          error={state.errors?.projectId}
        />

        <SelectField
          label="Echipa"
          help="Grupul care poate executa lucrarea."
          name="teamId"
          options={teams.map((team) => ({
            value: team.id,
            label: `${team.label} - ${formatLoad(teamWorkloadById?.[team.id])}`,
            help: "",
          }))}
          hint="Indicatorul arata cate lucrari active are deja fiecare echipa."
          error={state.errors?.teamId}
        />

        <SelectField
          label="Responsabil"
          help="Persoana care primeste notificari si urmareste executia."
          name="responsibleId"
          options={users.map((user) => ({
            value: user.id,
            label: `${user.label} - ${formatLoad(responsibleWorkloadById?.[user.id])}`,
            help: "",
          }))}
          hint="Lucrarile active ofera un indiciu rapid despre incarcare."
          error={state.errors?.responsibleId}
        />

        <label>
          <span className="block text-sm font-semibold text-[var(--foreground)]">Data de inceput</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Ziua in care lucrarea poate fi pornita in santier.</span>
          <Input name="startDate" type="date" className="mt-2" />
          <FieldError message={state.errors?.startDate} />
        </label>

        <label>
          <span className="block text-sm font-semibold text-[var(--foreground)]">Termen final</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Data la care lucrarea trebuie inchisa sau predata.</span>
          <Input name="dueDate" type="date" className="mt-2" />
          <FieldError message={state.errors?.dueDate} />
        </label>

        <label>
          <span className="block text-sm font-semibold text-[var(--foreground)]">Ore estimate</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Ajuta la planificare si compararea cu timpul real.</span>
          <Input name="estimatedHours" type="number" placeholder="0" className="mt-2" />
          <FieldError message={state.errors?.estimatedHours} />
        </label>

        <SelectField
          label="Prioritate"
          help="Ordinea in care lucrarea trebuie tratata."
          name="priority"
          defaultValue={TaskPriority.MEDIUM}
          options={priorityOptions}
          error={state.errors?.priority}
        />

        <SelectField
          label="Status initial"
          help="Starea operativa in momentul crearii."
          name="status"
          defaultValue={WorkOrderStatus.TODO}
          options={statusOptions}
          error={state.errors?.status}
        />

        <div className="md:col-span-2 xl:col-span-4">
          <label>
            <span className="block text-sm font-semibold text-[var(--foreground)]">Descriere</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">Adauga locatie, dependinte, materiale sau observatii de executie.</span>
            <Textarea name="description" rows={3} placeholder="Descriere, checklist, dependinte, locatie exacta..." className="mt-2" />
            <FieldError message={state.errors?.description} />
          </label>
        </div>
      </div>

      {!state.ok && state.message ? <p className="text-sm text-[#ffb4bd]">{state.message}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salveaza..." : "Adauga lucrare"}
        </Button>
      </div>
    </form>
  );
}
