import * as React from "react";
import { Input as HeroInput } from "@heroui/react";
import { cn } from "@/src/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
        <HeroInput
          ref={ref}
          className={cn(
            "h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors outline-none focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[rgba(95,142,193,0.2)] disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
          {...props}
      />
    );
  },
);
Input.displayName = "Input";
