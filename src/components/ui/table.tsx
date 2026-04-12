import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>;
}

export function TH({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn("border-b border-[#e1e9e3] px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-[#536557]", className)}>{children}</th>;
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b border-[#edf3ef] px-3 py-2 align-top", className)}>{children}</td>;
}
