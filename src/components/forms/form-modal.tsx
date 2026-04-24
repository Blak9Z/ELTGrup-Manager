"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";

type FormModalProps = {
  triggerLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
  triggerVariant?: "default" | "secondary" | "ghost" | "destructive";
};

export function FormModal({
  triggerLabel,
  title,
  description,
  children,
  triggerVariant = "default",
}: FormModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <Button variant={triggerVariant} type="button" onPress={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(7,12,18,0.72)] p-3 sm:items-center sm:p-5"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-panel)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <div>
                <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
                {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
              </div>
              <Button type="button" variant="ghost" size="sm" onPress={() => setOpen(false)} aria-label="Inchide formularul">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
