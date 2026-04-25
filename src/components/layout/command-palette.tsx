"use client";

import React, { useEffect, useState, useMemo } from "react";
import { 
  Search, 
  FileText, 
  Folder, 
  Users, 
  Briefcase, 
  Calendar as CalendarIcon, 
  Settings,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle 
} from "@/src/components/ui/dialog";
import { cn } from "@/src/lib/utils";

type CommandItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onSelect: () => void;
  category: string;
};

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const commands = useMemo<CommandItem[]>(() => [
    {
      id: "proiecte",
      title: "Proiecte",
      subtitle: "Vezi toate proiectele active",
      icon: <Folder className="h-4 w-4" />,
      category: "Navigare",
      onSelect: () => router.push("/proiecte"),
    },
    {
      id: "lucrari",
      title: "Lucrări",
      subtitle: "Gestionează ordinele de lucru",
      icon: <FileText className="h-4 w-4" />,
      category: "Navigare",
      onSelect: () => router.push("/lucrari"),
    },
    {
      id: "clienti",
      title: "Clienți",
      subtitle: "Baza de date clienți",
      icon: <Users className="h-4 w-4" />,
      category: "Navigare",
      onSelect: () => router.push("/clienti"),
    },
    {
      id: "calendar",
      title: "Calendar",
      subtitle: "Programări și termene limită",
      icon: <CalendarIcon className="h-4 w-4" />,
      category: "Navigare",
      onSelect: () => router.push("/calendar"),
    },
    {
      id: "setari",
      title: "Setări",
      subtitle: "Configurare sistem și profil",
      icon: <Settings className="h-4 w-4" />,
      category: "Sistem",
      onSelect: () => router.push("/setari"),
    },
  ], [router]);

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) => 
        cmd.title.toLowerCase().includes(lowerQuery) || 
        cmd.subtitle?.toLowerCase().includes(lowerQuery)
    );
  }, [query, commands]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 shadow-2xl">
        <DialogTitle className="sr-only">Comandă Globală</DialogTitle>
        <div className="flex items-center border-b border-[var(--border)] px-4 py-3">
          <Search className="mr-3 h-5 w-5 text-[var(--muted-strong)]" />
          <input
            autoFocus
            placeholder="Ce dorești să cauți? (proiecte, clienți, setări...)"
            className="flex-1 bg-transparent text-lg outline-none placeholder:text-[var(--muted)]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[rgba(15,24,34,0.5)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-strong)]">
            <span>ESC</span>
          </div>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-12 text-center text-[var(--muted)]">
              Nu am găsit niciun rezultat pentru "{query}"
            </div>
          ) : (
            Object.entries(
              filteredCommands.reduce((acc, cmd) => {
                if (!acc[cmd.category]) acc[cmd.category] = [];
                acc[cmd.category].push(cmd);
                return acc;
              }, {} as Record<string, CommandItem[]>)
            ).map(([category, items]) => (
              <div key={category} className="mb-2 last:mb-0">
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-strong)]">
                  {category}
                </div>
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.onSelect();
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[rgba(116,162,212,0.1)] group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[rgba(15,24,34,0.8)] text-[var(--muted)] group-hover:border-[rgba(116,162,212,0.3)] group-hover:text-[var(--foreground)]">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-xs text-[var(--muted)]">{item.subtitle}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[rgba(15,24,34,0.3)] px-4 py-2.5 text-[11px] text-[var(--muted-strong)]">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[var(--border)] bg-[rgba(15,24,34,0.5)] px-1">↑↓</kbd> Navigare
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[var(--border)] bg-[rgba(15,24,34,0.5)] px-1">↵</kbd> Selectare
            </span>
          </div>
          <span>Comandă Globală</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
