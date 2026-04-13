import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>;
}

export function TH({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "sticky top-0 border-b border-[color:var(--border)] bg-[rgba(12,20,36,0.96)] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#95a9c4]",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b border-[color:var(--border)] px-3 py-3 align-top text-[#dbe6f7]", className)}>{children}</td>;
}
