"use client";

import { useState } from "react";
import { InspectionResult } from "@prisma/client";

export function InspectionForm({ installationId }: { installationId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--muted-strong)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
      >
        Înregistrează verificare
      </button>
    );
  }

  return (
    <form
      action="/proiecte/installations/inspection-actions"
      method="post"
      className="mt-2 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await import("./inspection-actions").then((m) => m.createInstallationInspection(fd));
        setOpen(false);
      }}
    >
      <input type="hidden" name="installationId" value={installationId} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Data verificare</label>
          <input
            name="performedAt"
            type="date"
            defaultValue={new Date().toISOString().split("T")[0]}
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Rezultat</label>
          <select
            name="result"
            defaultValue="PASS"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]"
          >
            {Object.values(InspectionResult).map((r) => (
              <option key={r} value={r}>
                {r === "PASS"
                  ? "Conform"
                  : r === "MINOR_ISSUES"
                    ? "Probleme minore"
                    : r === "MAJOR_ISSUES"
                      ? "Probleme majore"
                      : "NECONFORM"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Constatări</label>
          <textarea
            name="findings"
            rows={3}
            placeholder="Detalii constatări..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Acțiuni corective</label>
          <textarea
            name="correctiveActions"
            rows={2}
            placeholder="Ce acțiuni au fost luate..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Următoarea verificare</label>
          <input
            name="nextDueAt"
            type="date"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]"
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            name="isAnnualPSI"
            type="checkbox"
            value="true"
            id="isAnnualPSI"
            defaultChecked
            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
          />
          <label htmlFor="isAnnualPSI" className="text-sm text-[var(--foreground)]">
            Verificare PSI anuală (auto-calculează +1 an)
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] transition-colors hover:border-[var(--border-strong)]"
        >
          Anulează
        </button>
        <button
          type="submit"
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent)]/90"
        >
          Salvează verificarea
        </button>
      </div>
    </form>
  );
}
