"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/src/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      onClick={() => signOut({ callbackUrl: "/autentificare" })}
      variant="secondary"
      className="h-10 gap-2 px-3"
    >
      <LogOut className="h-4 w-4" />
      Iesire
    </Button>
  );
}
