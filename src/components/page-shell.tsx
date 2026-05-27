import Link from "next/link";
import { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";

type PageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

const links = [
  { href: "/", label: "Magazzino" },
  { href: "/storico", label: "Storico" },
  { href: "/merci", label: "Gestione merci" },
  { href: "/merci/nuova", label: "Nuova merce" },
  { href: "/carico", label: "Carico" },
  { href: "/scarico", label: "Scarico" },
  { href: "/about", label: "About" },
];

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative mb-8 overflow-hidden rounded-[2rem] border border-white/60 bg-[var(--card)] p-6 shadow-panel backdrop-blur xl:p-8 print:hidden">
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-[var(--accent-soft)] blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-emerald-100/70 blur-3xl" />
        <BrandLogo />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow-sm">
              Mercato dei sapori
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {description}
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 print:contents">{children}</main>
    </div>
  );
}
