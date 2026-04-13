import * as React from "react";
import { Input as HeroInput } from "@heroui/react";
import { cn } from "@/src/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <HeroInput
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-[#354b63] bg-[#122133] px-3.5 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] transition-colors outline-none focus:border-[#4d6e90] focus:ring-2 focus:ring-[rgba(77,110,144,0.24)] disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
