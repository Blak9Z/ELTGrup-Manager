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
          "w-full rounded-lg border border-[color:var(--border)] bg-[rgba(14,24,42,0.85)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] transition-colors outline-none focus:border-[#3f6499] focus:ring-2 focus:ring-[rgba(63,100,153,0.35)] disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
