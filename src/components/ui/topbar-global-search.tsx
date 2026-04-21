"use client";

import { FormEvent, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { AppModule } from "@/src/lib/access-control";
import { cn } from "@/src/lib/utils";
import { Input } from "@/src/components/ui/input";

type SearchTarget = {
  module: AppModule;
  href: string;
};

const targetPriority: SearchTarget[] = [
  { module: "work_orders", href: "/lucrari" },
  { module: "projects", href: "/proiecte" },
  { module: "documents", href: "/documente" },
  { module: "materials", href: "/materiale" },
  { module: "calendar", href: "/calendar" },
];

const prefixToModule: Array<{ prefix: string; module: AppModule }> = [
  { prefix: "lucrare:", module: "work_orders" },
  { prefix: "task:", module: "work_orders" },
  { prefix: "proiect:", module: "projects" },
  { prefix: "proiecte:", module: "projects" },
  { prefix: "document:", module: "documents" },
  { prefix: "doc:", module: "documents" },
  { prefix: "material:", module: "materials" },
  { prefix: "mat:", module: "materials" },
  { prefix: "calendar:", module: "calendar" },
];

function extractSearchTarget(query: string) {
  const normalized = query.trim().toLowerCase();
  for (const item of prefixToModule) {
    if (normalized.startsWith(item.prefix)) {
      return {
        module: item.module,
        query: query.slice(item.prefix.length).trim(),
      };
    }
  }

  return { module: null, query: query.trim() };
}

export function TopbarGlobalSearch({
  visibleModules,
  className,
  inputClassName,
  placeholder,
}: {
  visibleModules: AppModule[];
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const visibleTargetMap = useMemo(() => {
    const visibleSet = new Set(visibleModules);
    return new Map(
      targetPriority.filter((target) => visibleSet.has(target.module)).map((target) => [target.module, target.href]),
    );
  }, [visibleModules]);

  function resolveRoute(rawQuery: string) {
    const parsed = extractSearchTarget(rawQuery);
    const finalQuery = parsed.query;
    if (!finalQuery) return null;

    if (parsed.module && visibleTargetMap.has(parsed.module)) {
      return { href: visibleTargetMap.get(parsed.module)!, query: finalQuery };
    }

    const currentTarget = targetPriority.find(
      (target) => visibleTargetMap.has(target.module) && (pathname === target.href || pathname.startsWith(`${target.href}/`)),
    );

    if (currentTarget) {
      return { href: currentTarget.href, query: finalQuery };
    }

    const fallback = targetPriority.find((target) => visibleTargetMap.has(target.module));
    if (!fallback) return null;

    return { href: fallback.href, query: finalQuery };
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = resolveRoute(query);
    if (!target) return;

    router.push(`${target.href}?q=${encodeURIComponent(target.query)}`);
  }

  return (
    <form onSubmit={onSubmit} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7f93ab]" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder || "Cauta in modulul activ sau foloseste proiect:, lucrare:, document:"}
        className={cn("h-10 rounded-lg border-[var(--border)] bg-[var(--surface-card)] pl-9 pr-20", inputClassName)}
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 inline-flex h-7 -translate-y-1/2 items-center rounded-md border border-[var(--border)] bg-[rgba(15,24,34,0.85)] px-2.5 text-[11px] font-semibold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)]"
      >
        Cauta
      </button>
    </form>
  );
}
