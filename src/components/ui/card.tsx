import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-xl border border-[#d6e2da] bg-white p-4 shadow-sm", className)}>{children}</section>;
}
