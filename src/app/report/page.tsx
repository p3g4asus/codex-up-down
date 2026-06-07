import Link from "next/link";

import { PageShell } from "@/components/page-shell";

export default function ReportHubPage() {
  return (
    <PageShell
      title="Report"
      description="Accedi ai report operativi: Storico movimenti, Previsionale vendite/scorte e Articoli."
    >
      <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-8 shadow-panel backdrop-blur">
        <h2 className="text-2xl font-semibold text-slate-950">Seleziona il report</h2>
        <p className="mt-2 text-sm text-slate-600">
          Scegli se consultare lo storico completo dei movimenti, il report previsionale oppure il report articoli.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/storico"
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Storico
          </Link>
          <Link
            href="/report/previsionale"
            className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong"
          >
            Previsionale
          </Link>
          <Link
            href="/report/articoli"
            className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Articoli
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
