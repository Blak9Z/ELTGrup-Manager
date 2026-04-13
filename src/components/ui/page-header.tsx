import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="rounded-2xl border border-[var(--border)]/80 bg-[var(--surface-2)] px-4 py-4 sm:px-5 sm:py-5">
      <div className="mb-3 flex items-center justify-between border-b border-[var(--border)]/60 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#93a7bc]">Operations Workspace</p>
        {actions}
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[#edf3fb] sm:text-[2rem]">{title}</h1>
        {subtitle ? <p className="max-w-4xl text-sm text-[#9eb0c4]">{subtitle}</p> : null}
      </div>
    </header>
  );
}
