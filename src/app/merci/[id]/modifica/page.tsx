import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedbackBanner } from "@/components/feedback-banner";
import { PageShell } from "@/components/page-shell";
import { ProductForm } from "@/components/product-form";
import { containerLabels } from "@/lib/containers";
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
  const returnTo = (() => {
    const raw = feedback?.returnTo;
    if (!raw) {
      return "../..";
    }

    try {
      const parsed = new URL(raw, "https://local");
      const query = parsed.searchParams.toString();
      return query ? `../..?${query}` : "../..";
    } catch {
      return "../..";
    }
  })();
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
      description="Aggiorna nome, descrizione facoltativa e soglia alert dell'articolo. La giacenza continua a dipendere esclusivamente dai movimenti di carico e scarico registrati nello storico."
    >
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <Link href={returnTo} className="font-semibold text-accent hover:text-accent-strong">
          Torna ai risultati
        </Link>
        <span aria-hidden="true">/</span>
        <span>Modifica articolo</span>
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
              code: product.code ?? undefined,
              plu: product.plu ?? undefined,
              description: product.description,
              container: product.container,
              unit: product.unit,
              alertThreshold: product.alertThreshold,
            }}
          />
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-950">Riepilogo articolo</h2>
          <dl className="mt-5 space-y-4 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <dt className="font-medium text-slate-500">Contenitore</dt>
              <dd className="text-lg font-semibold text-slate-950">{containerLabels[product.container]}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <dt className="font-medium text-slate-500">Unità di misura</dt>
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
              <dt className="font-medium text-slate-500">Venduto previsto mensile</dt>
              <dd className="text-lg font-semibold text-slate-950">{product.alertThreshold ?? "-"}</dd>
            </div>
          </dl>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-600">
            Per eliminare questo articolo torna alla schermata <Link href={returnTo} className="font-semibold text-accent">Gestione articoli</Link>. L&apos;eliminazione è consentita solo in assenza di movimenti.
          </div>
          {product._count.movements > 0 ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              L&apos;unità di misura non è modificabile perché questo articolo ha già movimenti nello storico.
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
