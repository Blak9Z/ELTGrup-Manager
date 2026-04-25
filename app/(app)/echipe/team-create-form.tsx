"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { initialActionState } from "@/src/lib/action-state";
import { createTeamAction } from "./actions";

type UserOption = {
  id: string;
  label: string;
};

type WorkerOption = {
  id: string;
  label: string;
  teamName: string | null;
};

export function TeamCreateForm({ users, workers }: { users: UserOption[]; workers: WorkerOption[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createTeamAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      const url = new URL(window.location.href);
      url.searchParams.delete("dialog");
      router.push(`${url.pathname}${url.search}`);
    }
    if (!state.ok && state.message) toast.error(state.message);
  }, [state, router]);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <div>
        <Input name="name" placeholder="Nume echipa" required />
        {state.errors?.name ? <p className="mt-1 text-xs text-[#ffb4bd]">{state.errors.name[0]}</p> : null}
      </div>
      <div>
        <Input name="code" placeholder="Cod echipa, ex. ELT-01" required />
        {state.errors?.code ? <p className="mt-1 text-xs text-[#ffb4bd]">{state.errors.code[0]}</p> : null}
      </div>
      <Input name="region" placeholder="Zona / regiune" />
      <select
        name="leadUserId"
        defaultValue=""
        className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
      >
        <option value="">Fara sef echipa</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.label}
          </option>
        ))}
      </select>
      <input type="hidden" name="isActive" value="true" />
      <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 md:col-span-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Membri</legend>
        {workers.length ? (
          <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
            {workers.map((worker) => (
              <label key={worker.id} className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[rgba(10,18,28,0.42)] px-3 py-2 text-sm text-[var(--foreground)]">
                <input type="checkbox" name="memberIds" value={worker.id} className="mt-1 h-4 w-4 accent-[#8dc1f5]" />
                <span className="min-w-0">
                  <span className="block truncate">{worker.label}</span>
                  <span className="block text-xs text-[var(--muted)]">{worker.teamName ? `Acum in ${worker.teamName}` : "Fara echipa"}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">Nu exista profiluri de muncitor disponibile.</p>
        )}
      </fieldset>
      <div className="flex justify-end md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salveaza..." : "Creeaza echipa"}
        </Button>
      </div>
    </form>
  );
}
