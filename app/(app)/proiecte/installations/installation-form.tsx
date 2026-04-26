"use client";

import { useState } from "react";
import { useActionState } from "react";
import { InstallationStatus } from "@prisma/client";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

export function InstallationForm({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      await import("./actions").then((m) => m.createInstallation(formData));
      setOpen(false);
      return null;
    },
    null,
  );

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-8 text-xs">
        + Adauga instalatie
      </Button>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Denumire</label>
          <Input name="name" placeholder="Ex: Centrala detectare adresabila" required className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Producator</label>
          <Input name="manufacturer" placeholder="Ex: Schneider Electric" required className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Model</label>
          <Input name="model" placeholder="Ex: Esmi MX 512" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Serie</label>
          <Input name="serialNumber" placeholder="SN123456" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Garantie (luni)</label>
          <Input name="warrantyMonths" type="number" defaultValue="24" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Status</label>
          <select name="status" defaultValue="INSTALLED" className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]">
            {Object.values(InstallationStatus).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Instalata la</label>
          <Input name="installedAt" type="date" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Urmatoare verificare</label>
          <Input name="nextCheckAt" type="date" className="h-10" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Anuleaza</Button>
        <Button type="submit" disabled={pending} size="sm">Salveaza</Button>
      </div>
    </form>
  );
}
