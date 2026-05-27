import { MovementType } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { prisma } from "@/lib/prisma";
import { unitLabels } from "@/lib/units";

export default async function Home() {
  const [products, recentMovements] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.movement.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { product: true },
    }),
  ]);

  const totals = {
    products: products.length,
    stock: products.reduce((total, product) => total + product.stock, 0),
    empty: products.filter((product) => product.stock === 0).length,
  };

  const lowStockProducts = products.filter(
    (product) => product.alertThreshold !== null && product.stock < product.alertThreshold,
  );

  return (
    <PageShell
      title="Cruscotto magazzino supermercato"
      description="Pannello operativo del Mercato dei Sapori di San Benedetto del Tronto per monitorare giacenze, carico e scarico merci."
    >
      <section className="reveal-section reveal-delay-1 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="relative overflow-hidden rounded-[2rem] border border-white/70 shadow-panel">
          <Image
            src="/branding/ortofrutta.jpg"
            alt="Banco ortofrutta"
            width={1200}
            height={700}
            className="h-[280px] w-full object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
              Brand locale
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Mercato dei Sapori</h2>
            <p className="mt-1 text-sm text-slate-100">
              San Benedetto del Tronto - gestione digitale di magazzino.
            </p>
          </div>
        </article>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <article className="relative overflow-hidden rounded-[2rem] border border-white/70 shadow-panel">
            <Image
              src="/branding/panetteria.jpg"
              alt="Reparto panetteria"
              width={900}
              height={500}
              className="h-[132px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-900/30" />
            <p className="absolute bottom-3 left-4 text-sm font-semibold text-white">Panetteria</p>
          </article>
          <article className="relative overflow-hidden rounded-[2rem] border border-white/70 shadow-panel">
            <Image
              src="/branding/pescheria.jpg"
              alt="Reparto pescheria"
              width={900}
              height={500}
              className="h-[132px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-900/30" />
            <p className="absolute bottom-3 left-4 text-sm font-semibold text-white">Pescheria</p>
          </article>
        </div>
      </section>

      <section className="stagger-grid mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Merci censite</p>
          <p className="mt-3 text-4xl font-semibold text-slate-950">{totals.products}</p>
        </article>
        <article className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Pezzi in giacenza</p>
          <p className="mt-3 text-4xl font-semibold text-slate-950">{totals.stock}</p>
        </article>
        <article className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Articoli a zero</p>
          <p className="mt-3 text-4xl font-semibold text-slate-950">{totals.empty}</p>
        </article>
      </section>

      <section className="reveal-section reveal-delay-2 mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-[var(--card)] shadow-panel backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Giacenza attuale</h2>
              <p className="mt-1 text-sm text-slate-600">Elenco merci disponibili in magazzino.</p>
            </div>
            <Link
              href="/merci/nuova"
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong"
            >
              Aggiungi merce
            </Link>
          </div>
          {products.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-600">
              Nessuna merce presente. Inizia dalla schermata Nuova merce.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-white/60 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Nome</th>
                    <th className="px-6 py-4 font-medium">Descrizione</th>
                    <th className="px-6 py-4 font-medium">Unita</th>
                    <th className="px-6 py-4 font-medium">Giacenza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {products.map((product) => {
                    const isLowStock = product.alertThreshold !== null && product.stock < product.alertThreshold;

                    return (
                      <tr key={product.id} className="align-top text-slate-700">
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          <div className="inline-flex items-center gap-2">
                            <span>{product.name}</span>
                            {isLowStock ? (
                              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-800">
                                Sotto soglia
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4 leading-6 text-slate-600">{product.description || "-"}</td>
                        <td className="px-6 py-4 text-slate-600">{unitLabels[product.unit]}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                            {product.stock} {unitLabels[product.unit]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50/80 p-6 shadow-panel backdrop-blur">
            <h2 className="text-xl font-semibold text-rose-900">Articoli in esaurimento</h2>
            {lowStockProducts.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-rose-900/80">
                Nessun articolo sotto soglia al momento.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {lowStockProducts.map((product) => (
                  <li key={product.id} className="rounded-2xl border border-rose-200 bg-white/90 p-4 text-sm text-rose-900">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{product.name}</span>
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
                        {product.stock} / soglia {product.alertThreshold}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-rose-700">
                      {unitLabels[product.unit]}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
            <h2 className="text-xl font-semibold text-slate-950">Azioni rapide</h2>
            <div className="mt-4 grid gap-3">
              <Link
                href="/carico"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-900 transition hover:-translate-y-0.5"
              >
                Registra un carico
              </Link>
              <Link
                href="/scarico"
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5"
              >
                Registra uno scarico
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
            <h2 className="text-xl font-semibold text-slate-950">Ultimi movimenti</h2>
            {recentMovements.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Nessuna operazione registrata al momento.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {recentMovements.map((movement) => (
                  <li key={movement.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-900">{movement.product.name}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          movement.type === MovementType.LOAD
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {movement.type === MovementType.LOAD ? "Carico" : "Scarico"}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-600">Quantita: {movement.quantity} {unitLabels[movement.product.unit]}</p>
                    {movement.note ? <p className="mt-1 text-slate-500">{movement.note}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </section>
    </PageShell>
  );
}
