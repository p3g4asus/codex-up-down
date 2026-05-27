import Link from "next/link";

import { FeedbackBanner } from "@/components/feedback-banner";
import { MovementForm } from "@/components/movement-form";
import { PageShell } from "@/components/page-shell";
import { prisma } from "@/lib/prisma";
import { unitLabels } from "@/lib/units";

type PageProps = {
  searchParams?: Promise<{
    kind?: string;
    message?: string;
  }>;
};

export default async function UnloadPage({ searchParams }: PageProps) {
  const feedback = searchParams ? await searchParams : undefined;
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <PageShell
      title="Scarico merci"
      description="Registra l'uscita di merce dal magazzino. Il sistema blocca automaticamente gli scarichi superiori alla disponibilita corrente."
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <FeedbackBanner kind={feedback?.kind} message={feedback?.message} />
          <MovementForm mode="unload" products={products} />
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-950">Controllo disponibilita</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Puoi scaricare solo merci gia presenti e con giacenza sufficiente.
          </p>
          {products.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-600">
              Nessuna merce disponibile. Vai a <Link href="/merci/nuova" className="font-semibold text-accent">Nuova merce</Link>.
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {products.map((product) => (
                <li key={product.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900">{product.name}</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                      {product.stock} {unitLabels[product.unit]} in stock
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{product.description || "-"}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Unita: {unitLabels[product.unit]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
