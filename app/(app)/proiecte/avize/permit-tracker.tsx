"use client";

import { useState } from "react";
import { PermitApplicationStatus, PermitType } from "@prisma/client";
import { Card } from "@/src/components/ui/card";

const statusLabels: Record<PermitApplicationStatus, string> = {
  SUBMITTED: "Depus",
  UNDER_REVIEW: "În analiză",
  APPROVED: "Avizat",
  REJECTED: "Respins",
  CORRECTIONS_NEEDED: "Solicitate corecții",
  RESUBMITTED: "Re-depus",
  EXPIRED: "Expirat",
};

const statusColors: Record<PermitApplicationStatus, string> = {
  SUBMITTED: "bg-amber-500/20 text-amber-400",
  UNDER_REVIEW: "bg-blue-500/20 text-blue-400",
  APPROVED: "bg-emerald-500/20 text-emerald-400",
  REJECTED: "bg-[rgba(190,95,111,0.25)] text-[#f6c7cf]",
  CORRECTIONS_NEEDED: "bg-[rgba(190,95,111,0.25)] text-[#f6c7cf]",
  RESUBMITTED: "bg-amber-500/20 text-amber-400",
  EXPIRED: "bg-[rgba(190,95,111,0.25)] text-[#f6c7cf]",
};

const typeLabels: Record<PermitType, string> = {
  AVIZ_ISU: "Aviz ISU",
  AVIZ_SSM: "Aviz SSM",
  AVIZ_POMPIERI: "Aviz Pompieri",
  RECEPTIE_PSI: "Recepție PSI",
};

interface Permit {
  id: string;
  type: PermitType;
  status: PermitApplicationStatus;
  submittedAt: Date | null;
  responseDate: Date | null;
  rejectionReason: string | null;
  notes: string | null;
}

export function PermitTracker({ permits, projectId }: { permits: Permit[]; projectId: string }) {
  const [open, setOpen] = useState(false);

  const byType = (type: PermitType) => permits.filter((p) => p.type === type);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Flux avize și recepții</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Tracking complet depunere → răspuns autoritate.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--muted-strong)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
        >
          + Adauga aviz
        </button>
      </div>

      {open && (
        <form action="/proiecte/avize/actions" method="post" className="mt-3 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <input type="hidden" name="projectId" value={projectId} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Tip aviz</label>
              <select name="type" className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]">
                {Object.values(PermitType).map((t) => (
                  <option key={t} value={t}>{typeLabels[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Data depunere</label>
              <input name="submittedAt" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] transition-colors hover:border-[var(--border-strong)]">Anulează</button>
            <button type="submit" className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent)]/90">Salvează avizul</button>
          </div>
        </form>
      )}

      <div className="mt-3 space-y-3">
        {Object.values(PermitType).map((type) => {
          const items = byType(type);
          return (
            <div key={type} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{typeLabels[type]}</p>
              {items.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-2.5 text-[11px] text-[var(--muted)]">Niciun aviz înregistrat.</p>
              ) : (
                items.map((permit) => (
                  <div key={permit.id} className="flex items-center justify-between rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-2.5 text-sm">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusColors[permit.status]}`}>
                          {statusLabels[permit.status]}
                        </span>
                        {permit.submittedAt && (
                          <span className="text-[11px] text-[var(--muted)]">Depus {new Date(permit.submittedAt).toLocaleDateString("ro-RO")}</span>
                        )}
                      </div>
                      {permit.responseDate && (
                        <p className="text-[11px] text-[var(--muted)]">Răspuns: {new Date(permit.responseDate).toLocaleDateString("ro-RO")}</p>
                      )}
                      {permit.rejectionReason && (
                        <p className="text-[11px] text-[var(--danger)]">Motiv respingere: {permit.rejectionReason}</p>
                      )}
                    </div>
                    <form action="/proiecte/avize/actions" method="post" className="contents">
                      <input type="hidden" name="id" value={permit.id} />
                      <input type="hidden" name="projectId" value={projectId} />
                      <select name="status" className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[10px] text-[var(--foreground)]">
                        {Object.values(PermitApplicationStatus).map((s) => (
                          <option key={s} value={s} selected={s === permit.status}>{statusLabels[s]}</option>
                        ))}
                      </select>
                      <button type="submit" className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-[var(--accent)]/90">Actualizează</button>
                    </form>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
