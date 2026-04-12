import * as React from "react";
import { cn } from "@/src/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-[#cfddd3] bg-white p-3 text-sm outline-none ring-[#12613d] transition focus:ring-2",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
