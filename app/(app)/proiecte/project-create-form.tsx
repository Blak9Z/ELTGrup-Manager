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

type Option = {
  value: string;
  label: string;
  help: string;
};

const projectTypeOptions: Option[] = [
  { value: ProjectType.RESIDENTIAL, label: "Rezidential", help: "Case, ansambluri si lucrari locative." },
  { value: ProjectType.COMMERCIAL, label: "Comercial", help: "Spatii comerciale, birouri si retail." },
  { value: ProjectType.INDUSTRIAL, label: "Industrial", help: "Hale, productie si infrastructura tehnica." },
  { value: ProjectType.INFRASTRUCTURE, label: "Infrastructura", help: "Drumuri, retele si lucrari utilitare." },
  { value: ProjectType.MAINTENANCE, label: "Mentenanta", help: "Interventii, service si lucrari recurente." },
];

const projectStatusOptions: Option[] = [
  { value: ProjectStatus.DRAFT, label: "Schita", help: "Inca se definitiveaza datele proiectului." },
  { value: ProjectStatus.PLANNED, label: "Planificat", help: "Aprobat si pregatit pentru lansare." },
  { value: ProjectStatus.ACTIVE, label: "In lucru", help: "Se executa in mod curent." },
  { value: ProjectStatus.BLOCKED, label: "Blocat", help: "Exista o piedica ce trebuie rezolvata." },
  { value: ProjectStatus.COMPLETED, label: "Finalizat", help: "Lucrarile au fost predate." },
  { value: ProjectStatus.CANCELED, label: "Anulat", help: "Proiectul nu mai continua." },
];

function FieldError({ message }: { message?: string[] }) {
  if (!message?.length) return null;
  return <p className="text-xs text-[#ffb4bd]">{message[0]}</p>;
}

function SelectField({
  label,
  help,
  name,
  required,
  defaultValue,
  options,
  error,
  className,
}: {
  label: string;
  help: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  options: Option[];
  error?: string[];
  className?: string;
}) {
  return (
    <label className={className}>
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
      <FieldError message={error} />
    </label>
  );
}

export function ProjectCreateForm({ clients }: { clients: ClientOption[] }) {
  const [state, formAction, pending] = useActionState(createProjectAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="md:col-span-2">
          <span className="block text-sm font-semibold text-[var(--foreground)]">Nume proiect</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Cum va aparea in liste, rapoarte si notificari.</span>
          <Input name="title" placeholder="De exemplu: Renovare sediu central" required className="mt-2" />
          <FieldError message={state.errors?.title} />
        </label>

        <label>
          <span className="block text-sm font-semibold text-[var(--foreground)]">Client</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Beneficiarul care va primi documentele si facturile.</span>
          <select
            name="clientId"
            required
            className="mt-2 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[rgba(95,142,193,0.2)]"
          >
            <option value="">Alege clientul</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <FieldError message={state.errors?.clientId} />
        </label>

        <SelectField
          label="Tip proiect"
          help="Ajuta la raportare si la setarea fluxului de lucru."
          name="type"
          defaultValue={ProjectType.COMMERCIAL}
          options={projectTypeOptions}
          error={state.errors?.type}
        />

        <SelectField
          label="Status initial"
          help="Starea in care porneste proiectul in mod operational."
          name="status"
          defaultValue={ProjectStatus.PLANNED}
          options={projectStatusOptions}
          error={state.errors?.status}
        />

        <label className="md:col-span-2">
          <span className="block text-sm font-semibold text-[var(--foreground)]">Adresa santier</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Locatia principala unde se va lucra.</span>
          <Input name="siteAddress" placeholder="Strada, numar, oras" required className="mt-2" />
          <FieldError message={state.errors?.siteAddress} />
        </label>

        <label>
          <span className="block text-sm font-semibold text-[var(--foreground)]">Valoare contract (RON)</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Suma contractata cu clientul.</span>
          <Input name="contractValue" placeholder="0" type="number" required className="mt-2" />
          <FieldError message={state.errors?.contractValue} />
        </label>

        <label>
          <span className="block text-sm font-semibold text-[var(--foreground)]">Buget estimat (RON)</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Costul planificat pentru executie si consumabile.</span>
          <Input name="estimatedBudget" placeholder="0" type="number" required className="mt-2" />
          <FieldError message={state.errors?.estimatedBudget} />
        </label>

        <label>
          <span className="block text-sm font-semibold text-[var(--foreground)]">Data de start estimata</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Cand te astepti sa inceapa proiectul.</span>
          <Input name="startDate" type="date" className="mt-2" />
          <FieldError message={state.errors?.startDate} />
        </label>

        <label>
          <span className="block text-sm font-semibold text-[var(--foreground)]">Data de final estimata</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">Termenul orientativ de predare catre client.</span>
          <Input name="endDate" type="date" className="mt-2" />
          <FieldError message={state.errors?.endDate} />
        </label>
      </div>

      {!state.ok && state.message ? <p className="text-sm text-[#ffb4bd]">{state.message}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salveaza..." : "Creeaza proiect"}
        </Button>
      </div>
    </form>
  );
}
