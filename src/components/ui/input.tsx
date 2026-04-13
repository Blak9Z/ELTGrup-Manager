import * as React from "react";
import { Input as HeroInput } from "@heroui/react";
import { cn } from "@/src/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <HeroInput
        ref={ref}
        className={cn(
          "h-10 w-full rounded-lg border border-[color:var(--border)] bg-[rgba(14,24,42,0.85)] px-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] transition-colors outline-none focus:border-[#3f6499] focus:ring-2 focus:ring-[rgba(63,100,153,0.35)] disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
