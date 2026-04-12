"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/autentificare" })}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d1ddd5] px-3 text-sm font-semibold text-[#24382b] hover:bg-[#f2f7f4]"
    >
      <LogOut className="h-4 w-4" />
      Iesire
    </button>
  );
}
