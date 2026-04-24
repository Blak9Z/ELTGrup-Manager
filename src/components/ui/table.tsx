import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <table
      className={cn(
        "w-full min-w-full border-collapse text-sm lg:min-w-[760px] [&_tbody_tr:nth-child(even)]:bg-[rgba(15,23,33,0.38)] [&_tbody_tr:hover]:bg-[rgba(35,54,75,0.34)]",
        className,
      )}
    >
      {children}
    </table>
  );
}

export function TH({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "top-0 z-[1] border-b border-[var(--border)] bg-[color:color-mix(in_oklab,var(--surface-card)_92%,#162233_8%)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] lg:sticky lg:px-4 lg:py-2.5",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn("border-b border-[var(--border)] px-3 py-2 align-top text-[var(--muted-strong)] lg:px-4 lg:py-3", className)}>
      {children}
    </td>
  );
}
