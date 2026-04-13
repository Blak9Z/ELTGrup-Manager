"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { DocumentCategory } from "@prisma/client";
import { createDocumentAction } from "./actions";
import { initialActionState } from "@/src/lib/action-state";
import { Input } from "@/src/components/ui/input";

type Option = { id: string; label: string };

export function DocumentUploadForm({
  projects,
  clients,
}: {
  projects: Option[];
  clients: Option[];
}) {
  const [state, formAction, pending] = useActionState(createDocumentAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4" encType="multipart/form-data">
      <div>
        <Input name="title" placeholder="Titlu document" required />
        {state.errors?.title ? <p className="mt-1 text-xs text-[#ffb4bd]">{state.errors.title[0]}</p> : null}
      </div>
      <div>
        <select name="category" className="h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm" defaultValue={DocumentCategory.OTHER}>
          {Object.values(DocumentCategory).map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>
      <div>
        <input name="file" type="file" className="h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm file:mr-2 file:border-0 file:bg-transparent" required />
        {state.errors?.file ? <p className="mt-1 text-xs text-[#ffb4bd]">{state.errors.file[0]}</p> : null}
      </div>
      <Input name="expiresAt" type="date" />
      <select name="projectId" className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
        <option value="">Fara proiect</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.label}</option>
        ))}
      </select>
      <select name="clientId" className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
        <option value="">Fara client</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>{client.label}</option>
        ))}
      </select>
      <Input name="tags" placeholder="Tag-uri separate prin virgula" className="md:col-span-2" />
      <div className="md:col-span-2 xl:col-span-4 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-[#3b6fe9] px-4 text-sm font-semibold text-white disabled:opacity-70"
        >
          {pending ? "Se incarca..." : "Salveaza document"}
        </button>
      </div>
    </form>
  );
}
