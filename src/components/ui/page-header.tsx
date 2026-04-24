import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(21,33,48,0.95),rgba(15,25,37,0.95))] px-4 py-4 shadow-[var(--shadow-panel)] sm:px-5">
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[rgba(133,173,219,0.11)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 left-6 h-28 w-48 rounded-full bg-[rgba(87,123,167,0.13)] blur-2xl" />
      <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">ELTGRUP Operational Suite</p>
          <span className="inline-flex h-5 items-center rounded-full border border-[rgba(93,147,200,0.5)] bg-[rgba(58,94,133,0.24)] px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#bfd7f4]">
            Live
          </span>
        </div>
        <div>{actions}</div>
      </div>
      <div className="relative space-y-1">
        <h1 className="text-[1.6rem] font-semibold tracking-tight text-[var(--foreground)] sm:text-[1.85rem]">{title}</h1>
        {subtitle ? <p className="max-w-5xl text-sm leading-relaxed text-[var(--muted)]">{subtitle}</p> : null}
      </div>
    </header>
  );
}
