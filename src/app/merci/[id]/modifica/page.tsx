import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedbackBanner } from "@/components/feedback-banner";
import { PageShell } from "@/components/page-shell";
import { ProductForm } from "@/components/product-form";
import { prisma } from "@/lib/prisma";
import { unitLabels } from "@/lib/units";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    kind?: string;
    message?: string;
    returnTo?: string;
  }>;
};

export default async function EditProductPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const feedback = searchParams ? await searchParams : undefined;
  const returnTo = feedback?.returnTo?.startsWith("/") ? feedback.returnTo : "/merci";
  const productId = Number(id);

  if (!Number.isInteger(productId) || productId <= 0) {
    notFound();
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      _count: {
        select: {
          movements: true,
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  return (
    <PageShell
      title={`Modifica ${product.name}`}
      description="Aggiorna nome, descrizione facoltativa e soglia alert della merce. La giacenza continua a dipendere esclusivamente dai movimenti di carico e scarico registrati nello storico."
    >
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <Link href={returnTo} className="font-semibold text-accent hover:text-accent-strong">
          Torna ai risultati
        </Link>
        <span aria-hidden="true">/</span>
        <span>Modifica merce</span>
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <FeedbackBanner kind={feedback?.kind} message={feedback?.message} />
          <ProductForm
            lockUnit={product._count.movements > 0}
            submitLabel="Salva modifiche"
            values={{
              id: product.id,
              name: product.name,
              description: product.description,
              unit: product.unit,
              alertThreshold: product.alertThreshold,
            }}
          />
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-950">Riepilogo merce</h2>
          <dl className="mt-5 space-y-4 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <dt className="font-medium text-slate-500">Unita di misura</dt>
              <dd className="text-lg font-semibold text-slate-950">{unitLabels[product.unit]}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <dt className="font-medium text-slate-500">Giacenza attuale</dt>
              <dd className="text-lg font-semibold text-slate-950">{product.stock} {unitLabels[product.unit]}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <dt className="font-medium text-slate-500">Movimenti registrati</dt>
              <dd className="text-lg font-semibold text-slate-950">{product._count.movements}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <dt className="font-medium text-slate-500">Soglia alert</dt>
              <dd className="text-lg font-semibold text-slate-950">{product.alertThreshold ?? "-"}</dd>
            </div>
          </dl>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-600">
            Per eliminare questa merce torna alla schermata <Link href={returnTo} className="font-semibold text-accent">Gestione merci</Link>. L&apos;eliminazione e consentita solo in assenza di movimenti.
          </div>
          {product._count.movements > 0 ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              L&apos;unita di misura non e modificabile perche questa merce ha gia movimenti nello storico.
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
