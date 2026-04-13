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
          "w-full rounded-xl border border-[#354b63] bg-[#122133] px-3.5 py-2.5 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] transition-colors outline-none focus:border-[#4d6e90] focus:ring-2 focus:ring-[rgba(77,110,144,0.24)] disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
