import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(22,36,62,0.82),rgba(14,24,43,0.82))] px-5 py-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[#f3f7ff]">{title}</h1>
        {subtitle ? <p className="text-sm text-[#aebfd7]">{subtitle}</p> : null}
      </div>
      {actions}
    </header>
  );
}
