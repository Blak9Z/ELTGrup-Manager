import { Card as HeroCard } from "@heroui/react";
import { cn } from "@/src/lib/utils";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <HeroCard
      className={cn(
        "rounded-2xl border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(18,29,50,0.96),rgba(12,21,37,0.96))] p-5 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.85)]",
        className,
      )}
    >
      {children}
    </HeroCard>
  );
}
