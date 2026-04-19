import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-panel)] sm:px-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">ELTGRUP Operational Suite</p>
        {actions}
      </div>
      <div className="space-y-1">
        <h1 className="text-[1.6rem] font-semibold tracking-tight text-[var(--foreground)] sm:text-[1.85rem]">{title}</h1>
        {subtitle ? <p className="max-w-5xl text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
    </header>
  );
}
