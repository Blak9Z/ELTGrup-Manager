import { Card as HeroCard } from "@heroui/react";
import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <HeroCard
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-5",
        className,
      )}
    >
      {children}
    </HeroCard>
  );
}
