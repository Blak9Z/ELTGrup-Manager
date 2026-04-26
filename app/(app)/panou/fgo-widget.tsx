"use client";

import { useState } from "react";
import { useActionState } from "react";

export function FgoWidget({ fgoStats }: { fgoStats: { sent: number; pending: number; errors: number } }) {
  const [state, formAction, pending] = useActionState(
    async (_: unknown, fd: FormData) => {
      const res = await import("../facturi/actions").then((m) => m.sendInvoiceToFgo(fd));
      return res;
    },
    null,
  );

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-4 mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
        eFactura FGO — ANAF
      </p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface)] p-2 text-center">
          <p className="text-lg font-semibold text-emerald-400">{fgoStats.sent}</p>
          <p className="text-[10px] text-[var(--muted)]">Transmit</p>
        </div>
        <div className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface)] p-2 text-center">
          <p className="text-lg font-semibold text-[var(--muted-strong)]">{fgoStats.pending}</p>
          <p className="text-[10px] text-[var(--muted)]">In astept</p>
        </div>
        <div className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface)] p-2 text-center">
          <p className="text-lg font-semibold text-[var(--danger)]">{fgoStats.errors}</p>
          <p className="text-[10px] text-[var(--muted)]">Erori</p>
        </div>
      </div>

      <form action={formAction} className="flex items-center gap-2">
        <input name="invoiceId" placeholder="ID factura" className="h-8 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)]" />
        <input name="projectId" placeholder="Project ID (optional)" className="h-8 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--foreground)]" />
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent)]/90 disabled:opacity-40"
        >
          {pending ? "Transmit..." : "Trimite FGO"}
        </button>
      </form>

      {state && (
        <p className={`mt-2 text-[11px] ${state.ok ? "text-emerald-400" : "text-[var(--danger)]"}`}>
          {state.ok ? `✅ Transmis — tracking ID: ${state.trackingId}` : `❌ Eroare: ${state.errors?.[0]?.message || "Necunoscut"}`}
        </p>
      )}
    </div>
  );
}
