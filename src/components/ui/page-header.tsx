import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a2b1f]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[#5b6c60]">{subtitle}</p> : null}
      </div>
      {actions}
    </header>
  );
}
