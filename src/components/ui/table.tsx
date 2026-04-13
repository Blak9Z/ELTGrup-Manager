import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return <table className={cn("w-full min-w-[680px] border-collapse text-sm", className)}>{children}</table>;
}

export function TH({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "sticky top-0 border-b border-[var(--border)]/80 bg-[#0f1b2b] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.11em] text-[#8ca1b8]",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b border-[var(--border)]/60 px-4 py-3.5 align-top text-[#d7e3f0]", className)}>{children}</td>;
}
