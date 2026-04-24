import * as React from "react";
import { TextArea as HeroTextarea } from "@heroui/react";
import { cn } from "@/src/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows, ...props }, ref) => {
    return (
      <HeroTextarea
        ref={ref}
        rows={rows ?? 3}
        className={cn(
          "w-full rounded-lg border border-[var(--border)] bg-[color:color-mix(in_oklab,var(--surface-card)_85%,#0a1420_15%)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] shadow-[inset_0_1px_0_rgba(196,219,243,0.04)] transition-colors outline-none focus:-translate-y-px focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[rgba(95,142,193,0.24)] disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
