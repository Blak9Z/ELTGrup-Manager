"use client";

import { DocumentCategory } from "@prisma/client";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createDocumentAction } from "./actions";
import { initialActionState } from "@/src/lib/action-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

const documentCategoryLabels: Record<DocumentCategory, string> = {
  CONTRACT: "Contract",
  ANNEX: "Anexa",
  OFFER: "Oferta",
  INVOICE: "Factura",
  DELIVERY_NOTE: "Aviz livrare",
  SITE_REPORT: "Raport santier",
  PHOTO: "Foto",
  COMPLIANCE: "Conformitate",
  PERMIT: "Autorizatie",
  HANDOVER: "Predare",
  OTHER: "Altele",
};

type Option = { id: string; label: string };

export function DocumentUploadForm({
  projects,
  clients,
  workOrders,
  defaultProjectId,
}: {
  projects: Option[];
  clients: Option[];
  workOrders: Option[];
  defaultProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(createDocumentAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Titlu</label>
            <Input name="title" placeholder="Ex: Contract executie etapa 2" required />
            <p className="text-xs text-[var(--muted)]">Nume scurt si clar, folosit in cautare si in listarea documentelor.</p>
            {state.errors?.title ? <p className="text-xs text-[#ffb4bd]">{state.errors.title[0]}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Fisier</label>
            <input
              name="file"
              type="file"
              className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--foreground)]"
              required
            />
            <p className="text-xs text-[var(--muted)]">Incarca PDF, imagini, arhive sau orice fisier relevant pentru proiect.</p>
            {state.errors?.file ? <p className="text-xs text-[#ffb4bd]">{state.errors.file[0]}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Tag-uri</label>
            <Input name="tags" placeholder="plan:hvac, avizare, oferta, revizie" />
            <p className="text-xs text-[var(--muted)]">
              Separă cu virgule. Foloseste tag-uri ca <span className="font-semibold text-[var(--foreground)]">plan:electrical</span> sau <span className="font-semibold text-[var(--foreground)]">plan:hvac</span> pentru documentele de proiect.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Categorie</label>
            <select
              name="category"
              className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
              defaultValue={DocumentCategory.OTHER}
            >
              {Object.values(DocumentCategory).map((category) => (
                <option key={category} value={category}>
                  {documentCategoryLabels[category] ?? category}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--muted)]">Alege tipul documentului pentru filtrare si pentru rapoarte mai clare.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Vizibilitate</label>
            <select
              name="isPrivate"
              className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
              defaultValue="true"
            >
              <option value="true">Privat - doar echipa</option>
              <option value="false">Public - conform accesului proiectului</option>
            </select>
            <p className="text-xs text-[var(--muted)]">Documentele sunt private in mod implicit pana cand alegi altfel.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Expira la</label>
            <Input name="expiresAt" type="date" />
            <p className="text-xs text-[var(--muted)]">Optional. Ajuta la urmarirea documentelor cu valabilitate limitata.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Proiect</label>
              <select
                name="projectId"
                defaultValue={defaultProjectId || ""}
                className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
              >
                <option value="">Fara proiect</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Lucrare</label>
              <select
                name="workOrderId"
                className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
              >
                <option value="">Fara lucrare</option>
                {workOrders.map((workOrder) => (
                  <option key={workOrder.id} value={workOrder.id}>
                    {workOrder.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Client</label>
              <select
                name="clientId"
                className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
              >
                <option value="">Fara client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-card)]/80 px-4 py-3">
        <p className="text-xs text-[var(--muted)]">Leaga documentul de proiect, lucrare sau client pentru a aparea mai clar in sectiunile corecte.</p>
        <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
          {pending ? "Se incarca..." : "Salveaza document"}
        </Button>
      </div>
    </form>
  );
}
