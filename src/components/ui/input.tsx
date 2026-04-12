import * as React from "react";
import { cn } from "@/src/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-lg border border-[#cfddd3] bg-white px-3 text-sm outline-none ring-[#12613d] transition focus:ring-2",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
