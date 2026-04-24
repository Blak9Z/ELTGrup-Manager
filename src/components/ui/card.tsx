import { Card as HeroCard } from "@heroui/react";
import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <HeroCard
      className={cn(
        "surface-interactive relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(22,33,48,0.93),rgba(16,26,38,0.94))] p-4 shadow-[var(--shadow-panel)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(171,203,238,0.45),transparent)] sm:p-5",
        className,
      )}
    >
      {children}
    </HeroCard>
  );
}
