"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/src/components/ui/button";

export function ConfirmSubmitButton({
  text,
  confirmMessage,
  variant = "secondary",
  size = "sm",
}: {
  text: string;
  confirmMessage: string;
  variant?: "default" | "secondary" | "destructive" | "ghost";
  size?: "default" | "sm";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Se proceseaza..." : text}
    </Button>
  );
}
