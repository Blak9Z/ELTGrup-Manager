import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return <table className={cn("w-full min-w-[760px] border-collapse text-sm", className)}>{children}</table>;
}

export function TH({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "sticky top-0 z-[1] border-b border-[var(--border)] bg-[var(--surface-card)] px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b border-[var(--border)] px-4 py-3 align-top text-[var(--muted-strong)]", className)}>{children}</td>;
}
