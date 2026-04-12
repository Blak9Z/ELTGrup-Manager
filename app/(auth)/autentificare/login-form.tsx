"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

export function LoginForm() {
  const [email, setEmail] = useState("alex.pop@eltgrup.ro");
  const [password, setPassword] = useState("Parola123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Date de autentificare invalide.");
      return;
    }

    router.push(params.get("callbackUrl") || "/panou");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-[#2f4636]">Email</label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#2f4636]">Parola</label>
        <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
      </div>
      {error ? <p className="text-sm text-[#9b1f30]">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Se autentifica..." : "Autentificare"}
      </Button>
    </form>
  );
}
