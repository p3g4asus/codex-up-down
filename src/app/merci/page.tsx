import Link from "next/link";

import { DeleteProductButton } from "@/components/delete-product-button";
import { FeedbackBanner } from "@/components/feedback-banner";
import { ProductSearchForm } from "@/components/product-search-form";
import { PageShell } from "@/components/page-shell";
import { withBasePath } from "@/lib/base-path";
import { prisma } from "@/lib/prisma";
import { unitLabels } from "@/lib/units";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    sort?: string;
    dir?: string;
    kind?: string;
    message?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: PageProps) {
  const feedback = searchParams ? await searchParams : undefined;
  const query = feedback?.q?.trim();
  const sort =
    feedback?.sort === "description" ||
    feedback?.sort === "stock" ||
    feedback?.sort === "movements" ||
    feedback?.sort === "alert"
      ? feedback.sort
      : "name";
  const dir = feedback?.dir === "desc" ? "desc" : "asc";
  const returnQuery = new URLSearchParams();
  if (query) {
    returnQuery.set("q", query);
  }
  if (sort !== "name") {
    returnQuery.set("sort", sort);
  }
  if (dir !== "asc") {
    returnQuery.set("dir", dir);
  }
  const baseProductsPath = withBasePath("/merci");
  const returnTo = returnQuery.toString() ? `${baseProductsPath}?${returnQuery.toString()}` : baseProductsPath;
  const products = await prisma.product.findMany({
    where: query
      ? {
          OR: [
            {
              name: {
                contains: query,
              },
            },
            {
              description: {
                contains: query,
              },
            },
          ],
        }
      : undefined,
    orderBy:
      sort === "description"
        ? [{ description: dir }, { name: "asc" }]
        : sort === "alert"
          ? [{ alertThreshold: dir }, { name: "asc" }]
        : sort === "stock"
          ? [{ stock: dir }, { name: "asc" }]
          : sort === "movements"
            ? [{ movements: { _count: dir } }, { name: "asc" }]
            : [{ name: dir }],
    include: {
      _count: {
        select: {
          movements: true,
        },
      },
    },
  });

  return (
    <PageShell
      title="Gestione merci"
      description="Consulta l'anagrafica completa delle merci, apri la schermata di modifica e rimuovi solo gli articoli che non hanno ancora movimenti nello storico."
    >
      <div className="space-y-4">
        <FeedbackBanner kind={feedback?.kind} message={feedback?.message} />
      </div>

      <section className="mt-4 rounded-[2rem] border border-white/70 bg-[var(--card)] shadow-panel backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Anagrafica merci</h2>
            <p className="mt-1 text-sm text-slate-600">Modifica i dati descrittivi o elimina le merci mai movimentate.</p>
          </div>
          <Link
            href="/merci/nuova"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong"
          >
            Nuova merce
          </Link>
        </div>

        <div className="border-b border-slate-200/70 px-6 py-5">
          <ProductSearchForm query={feedback?.q ?? ""} sort={sort} dir={dir} />
        </div>

        {products.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-600">
            {query
              ? `Nessuna merce trovata per ${query}.`
              : "Nessuna merce disponibile. Inseriscine una nuova per iniziare."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-white/60 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">
                    <a href={returnTo === baseProductsPath ? `${baseProductsPath}?sort=name&dir=desc` : `${baseProductsPath}?${new URLSearchParams({ ...(query ? { q: query } : {}), sort: "name", dir: sort === "name" && dir === "asc" ? "desc" : "asc" }).toString()}`} className="hover:text-slate-700">
                      Nome{sort === "name" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                    </a>
                  </th>
                  <th className="px-6 py-4 font-medium">
                    <a href={`${baseProductsPath}?${new URLSearchParams({ ...(query ? { q: query } : {}), sort: "description", dir: sort === "description" && dir === "asc" ? "desc" : "asc" }).toString()}`} className="hover:text-slate-700">
                      Descrizione{sort === "description" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                    </a>
                  </th>
                  <th className="px-6 py-4 font-medium">Unita</th>
                  <th className="px-6 py-4 font-medium">
                    <a href={`${baseProductsPath}?${new URLSearchParams({ ...(query ? { q: query } : {}), sort: "alert", dir: sort === "alert" && dir === "asc" ? "desc" : "asc" }).toString()}`} className="hover:text-slate-700">
                      Soglia alert{sort === "alert" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                    </a>
                  </th>
                  <th className="px-6 py-4 font-medium">
                    <a href={`${baseProductsPath}?${new URLSearchParams({ ...(query ? { q: query } : {}), sort: "stock", dir: sort === "stock" && dir === "asc" ? "desc" : "asc" }).toString()}`} className="hover:text-slate-700">
                      Giacenza{sort === "stock" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                    </a>
                  </th>
                  <th className="px-6 py-4 font-medium">
                    <a href={`${baseProductsPath}?${new URLSearchParams({ ...(query ? { q: query } : {}), sort: "movements", dir: sort === "movements" && dir === "asc" ? "desc" : "asc" }).toString()}`} className="hover:text-slate-700">
                      Movimenti{sort === "movements" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                    </a>
                  </th>
                  <th className="px-6 py-4 font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {products.map((product) => {
                  return (
                    <tr key={product.id} className="align-top text-slate-700">
                      <td className="px-6 py-4 font-semibold text-slate-900">{product.name}</td>
                      <td className="px-6 py-4 leading-6 text-slate-600">{product.description || "-"}</td>
                      <td className="px-6 py-4 text-slate-600">{unitLabels[product.unit]}</td>
                      <td className="px-6 py-4 text-slate-600">{product.alertThreshold ?? "-"}</td>
                      <td className="px-6 py-4">{product.stock} {unitLabels[product.unit]}</td>
                      <td className="px-6 py-4">{product._count.movements}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-3">
                          <Link
                            href={`/merci/${product.id}/modifica?${new URLSearchParams({ returnTo }).toString()}`}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent"
                          >
                            Modifica
                          </Link>
                          <DeleteProductButton
                            productId={product.id}
                            productName={product.name}
                            productUnit={product.unit}
                            movementCount={product._count.movements}
                          />
                        </div>
                        {product._count.movements > 0 ? (
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            Eliminazione protetta: per merci con movimenti viene richiesto un codice segreto.
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}
