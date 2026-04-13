import { Card as HeroCard } from "@heroui/react";
import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <HeroCard
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--border)]/80 bg-[var(--surface-2)] p-4 shadow-[0_22px_50px_-42px_rgba(0,0,0,0.95)] sm:p-5",
        className,
      )}
    >
      {children}
    </HeroCard>
  );
}
