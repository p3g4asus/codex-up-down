import { MovementType } from "@prisma/client";

import { ArticlesFiltersForm } from "@/components/articles-filters-form";
import { PageShell } from "@/components/page-shell";
import { PrintButton } from "@/components/print-button";
import {
  buildArticlesRows,
  buildArticlesSearchParams,
  getArticlesPage,
  getArticlesPageSize,
  getArticlesSort,
  getArticlesSortDir,
  resolveArticlesReferenceDate,
  sortArticlesRows,
  type ArticlesFilterParams,
} from "@/lib/articoli-report";
import { withBasePath } from "@/lib/base-path";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: Promise<ArticlesFilterParams>;
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
});

export default async function ArticlesReportPage({ searchParams }: PageProps) {
  const filters = searchParams ? await searchParams : undefined;
  const currentPage = getArticlesPage(filters);
  const pageSize = getArticlesPageSize(filters);
  const sort = getArticlesSort(filters);
  const dir = getArticlesSortDir(filters);
  const referenceDate = resolveArticlesReferenceDate(filters?.date);
  const hasCustomDateFilter = Boolean(filters?.date?.trim());
  const selectionLabel = hasCustomDateFilter ? `Data selezionata: ${dateFormatter.format(referenceDate)}` : "Data selezionata: Oggi";
  const selectionBadgeClass = hasCustomDateFilter
    ? "bg-violet-100 text-violet-800"
    : "bg-emerald-100 text-emerald-800";

  const [products, movementsAfterReferenceByType, latestLoadsUntilReference] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        stock: true,
      },
    }),
    prisma.movement.groupBy({
      by: ["productId", "type"],
      where: {
        createdAt: {
          gt: referenceDate,
        },
      },
      _sum: {
        quantity: true,
      },
    }),
    prisma.movement.groupBy({
      by: ["productId"],
      where: {
        type: MovementType.LOAD,
        createdAt: {
          lte: referenceDate,
        },
      },
      _max: {
        createdAt: true,
      },
    }),
  ]);

  const loadsAfterReferenceMap = new Map<number, number>();
  const unloadsAfterReferenceMap = new Map<number, number>();

  for (const row of movementsAfterReferenceByType) {
    if (row.type === MovementType.LOAD) {
      loadsAfterReferenceMap.set(row.productId, row._sum.quantity ?? 0);
    }

    if (row.type === MovementType.UNLOAD) {
      unloadsAfterReferenceMap.set(row.productId, row._sum.quantity ?? 0);
    }
  }

  const lastLoadAtByProduct = new Map<number, Date | null>(
    latestLoadsUntilReference.map((row) => [row.productId, row._max.createdAt ?? null]),
  );

  let reportRows = buildArticlesRows(products, loadsAfterReferenceMap, unloadsAfterReferenceMap, lastLoadAtByProduct);

  const filterProductId = filters?.productId ? Number(filters.productId) : NaN;
  if (Number.isInteger(filterProductId) && filterProductId > 0) {
    reportRows = reportRows.filter((row) => row.productId === filterProductId);
  }

  reportRows = sortArticlesRows(reportRows, sort, dir);

  const totalCount = reportRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedRows = reportRows.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  function buildPageHref(page: number) {
    const query = buildArticlesSearchParams({ ...filters, page: String(page), pageSize: String(pageSize), sort, dir });
    return query ? `${withBasePath("/report/articoli")}?${query}` : withBasePath("/report/articoli");
  }

  function buildSortHref(nextSort: string) {
    const nextDir = sort === nextSort && dir === "asc" ? "desc" : "asc";
    const query = buildArticlesSearchParams({
      ...filters,
      sort: nextSort,
      dir: nextDir,
      page: "1",
      pageSize: String(pageSize),
    });
    return query ? `${withBasePath("/report/articoli")}?${query}` : withBasePath("/report/articoli");
  }

  function getSortIndicator(column: string) {
    if (sort !== column) {
      return "";
    }

    return dir === "asc" ? " ↑" : " ↓";
  }

  return (
    <PageShell
      title="Report articoli"
      description="Consulta la giacenza per articolo alla data selezionata e la data dell'ultimo carico registrato."
    >
      <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <ArticlesFiltersForm
            filters={filters}
            products={products.map((product) => ({ id: product.id, name: product.name }))}
            pageSize={pageSize}
            sort={sort}
            dir={dir}
          />
          <PrintButton label="Stampa report articoli" />
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/70 bg-[var(--card)] shadow-panel backdrop-blur print:rounded-none print:border-0 print:bg-white print:shadow-none">
        <div className="border-b border-slate-200/70 px-6 py-5 print:px-0">
          <h2 className="text-xl font-semibold text-slate-950">Tabella articoli</h2>
          <p className="mt-1 text-sm text-slate-600">
            Data di riferimento: {dateFormatter.format(referenceDate)}.
          </p>
          <p className="mt-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${selectionBadgeClass}`}>
              {selectionLabel}
            </span>
          </p>
        </div>

        {pagedRows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-600 print:px-0">
            Nessun dato disponibile con i filtri selezionati.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-white/60 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("product")} className="hover:text-slate-700">
                      Articolo{getSortIndicator("product")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("stock")} className="hover:text-slate-700">
                      Giacenza alla data attuale{getSortIndicator("stock")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("lastLoadAt")} className="hover:text-slate-700">
                      Data ultimo carico{getSortIndicator("lastLoadAt")}
                    </a>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {pagedRows.map((row) => (
                  <tr key={row.productId} className="text-slate-700">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.productName}</td>
                    <td className="px-4 py-3">{row.stockAtReference}</td>
                    <td className="px-4 py-3">
                      {row.lastLoadAt ? dateFormatter.format(row.lastLoadAt) : "Nessun carico"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {totalCount > 0 ? (
        <section className="mt-6 flex flex-col gap-3 rounded-[2rem] border border-white/70 bg-[var(--card)] p-5 shadow-panel backdrop-blur md:flex-row md:items-center md:justify-between print:hidden">
          <p className="text-sm text-slate-600">
            Pagina {safeCurrentPage} di {totalPages}. Visualizzati {pagedRows.length} articoli su {totalCount}, con {pageSize} righe per pagina.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={buildPageHref(Math.max(1, safeCurrentPage - 1))}
              aria-disabled={safeCurrentPage === 1}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              Precedente
            </a>
            <a
              href={buildPageHref(Math.min(totalPages, safeCurrentPage + 1))}
              aria-disabled={safeCurrentPage === totalPages}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              Successiva
            </a>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
