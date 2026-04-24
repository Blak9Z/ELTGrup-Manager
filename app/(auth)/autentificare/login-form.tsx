"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(
        result.error === "CredentialsSignin"
          ? "Credentiale invalide. Verifica adresa de email si parola."
          : "Autentificarea a esuat din cauza unei erori de server. Reincearca in cateva secunde.",
      );
      return;
    }

    router.push(params.get("callbackUrl") || "/panou");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-[#cfdbed]">Email</label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username" autoFocus />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#cfdbed]">Parola</label>
        <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password" />
      </div>
      {error ? <p className="text-sm text-[#ffb4bd]">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Se autentifica..." : "Autentificare"}
      </Button>
      <p className="text-center text-xs text-[#84a4c5]">Suport tehnic: administrator ELTGRUP</p>
    </form>
  );
}
