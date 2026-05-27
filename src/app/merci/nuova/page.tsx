import { FeedbackBanner } from "@/components/feedback-banner";
import { PageShell } from "@/components/page-shell";
import { ProductForm } from "@/components/product-form";
import { prisma } from "@/lib/prisma";
import { unitLabels } from "@/lib/units";

type PageProps = {
  searchParams?: Promise<{
    kind?: string;
    message?: string;
  }>;
};

export default async function NewProductPage({ searchParams }: PageProps) {
  const feedback = searchParams ? await searchParams : undefined;
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return (
    <PageShell
      title="Nuova merce"
      description="Crea una nuova voce nel database merci con nome, unita di misura e soglia opzionale. La giacenza iniziale parte da zero e verra aggiornata dalle schermate di carico e scarico."
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <FeedbackBanner kind={feedback?.kind} message={feedback?.message} />
          <ProductForm />
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-950">Ultime merci inserite</h2>
          {products.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Nessuna merce registrata. Compila il modulo per popolare il database.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {products.map((product) => (
                <li key={product.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900">{product.name}</span>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      Giacenza {product.stock} {unitLabels[product.unit]}
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
