import { MovementType } from "@prisma/client";

import { ArticlesFiltersForm } from "@/components/articles-filters-form";
import { PageShell } from "@/components/page-shell";
import { PrintButton } from "@/components/print-button";
import {
  buildArticlesWhere,
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
import { containerLabels } from "@/lib/containers";
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
  const selectedProductName = filters?.productId
    ? (await prisma.product.findFirst({
        where: { id: Number(filters.productId) },
        select: { name: true },
      }))?.name ?? null
    : null;
  const hasCustomDateFilter = Boolean(filters?.date?.trim());
  const selectionLabel = hasCustomDateFilter ? `Data selezionata: ${dateFormatter.format(referenceDate)}` : "Data selezionata: Oggi";
  const selectionBadgeClass = hasCustomDateFilter
    ? "bg-violet-100 text-violet-800"
    : "bg-emerald-100 text-emerald-800";
  const activeSearchLabel = filters?.q?.trim() ? `Ricerca: ${filters.q.trim()}` : null;
  const activeArticleLabel = selectedProductName ? `Articolo: ${selectedProductName}` : null;
  const activePageSizeLabel = pageSize !== 12 ? `Righe per pagina: ${pageSize}` : null;
  const hasActiveFilters = Boolean(filters?.q?.trim() || filters?.productId || filters?.date?.trim());

  const [products, latestLoadsUntilReference] = await Promise.all([
    prisma.product.findMany({
      where: buildArticlesWhere(filters),
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        stock: true,
        alertThreshold: true,
        container: true,
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

  const lastLoadAtByProduct = new Map<number, Date | null>(
    latestLoadsUntilReference.map((row) => [row.productId, row._max.createdAt ?? null]),
  );

  let reportRows = buildArticlesRows(products, lastLoadAtByProduct);

  const filterProductId = filters?.productId ? Number(filters.productId) : NaN;
  if (Number.isInteger(filterProductId) && filterProductId > 0) {
    reportRows = reportRows.filter((row) => row.productId === filterProductId);
  }

  reportRows = sortArticlesRows(reportRows, sort, dir);

  const totalCount = reportRows.length;
  const withLastLoadCount = reportRows.filter((row) => row.lastLoadAt !== null).length;
  const withoutLastLoadCount = totalCount - withLastLoadCount;
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
      description="Consulta il report articoli, applica i filtri e verifica giacenza e ultimo carico alla data selezionata."
    >
      <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <ArticlesFiltersForm
            filters={filters}
            products={products.map((product) => ({ id: product.id, code: product.code ?? "", name: product.name }))}
            pageSize={pageSize}
            sort={sort}
            dir={dir}
          />
          <PrintButton label="Stampa report articoli" />
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/70 bg-[var(--card)] shadow-panel backdrop-blur print:rounded-none print:border-0 print:bg-white print:shadow-none">
        <div className="border-b border-slate-200/70 px-6 py-5 print:px-0">
          <h2 className="text-xl font-semibold text-slate-950">Report articoli</h2>
          <p className="mt-1 text-sm text-slate-600">
            Data di riferimento: {dateFormatter.format(referenceDate)}.
          </p>
          {hasActiveFilters ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
                <span className={`inline-flex rounded-full px-3 py-1 ${selectionBadgeClass}`}>{selectionLabel}</span>
                {activeSearchLabel ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                    {activeSearchLabel}
                  </span>
                ) : null}
                {activeArticleLabel ? (
                  <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sky-800">
                    {activeArticleLabel}
                  </span>
                ) : null}
                {activePageSizeLabel ? (
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    {activePageSizeLabel}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {totalCount > 0 ? (
          <div className="grid gap-4 px-6 py-6 md:grid-cols-3 print:px-0">
            <article className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:shadow-none print:border-slate-200">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Articoli trovati</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{totalCount}</p>
            </article>
            <article className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:shadow-none print:border-slate-200">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Con ultimo carico</p>
              <p className="mt-3 text-4xl font-semibold text-emerald-700">{withLastLoadCount}</p>
            </article>
            <article className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:shadow-none print:border-slate-200">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Senza ultimo carico</p>
              <p className="mt-3 text-4xl font-semibold text-amber-700">{withoutLastLoadCount}</p>
            </article>
          </div>
        ) : null}

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
                    <a href={buildSortHref("code")} className="hover:text-slate-700">
                      Codice articolo{getSortIndicator("code")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("product")} className="hover:text-slate-700">
                      Nome articolo{getSortIndicator("product")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("alertThreshold")} className="hover:text-slate-700">
                      Vendita mensile prevista{getSortIndicator("alertThreshold")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("container")} className="hover:text-slate-700">
                      Contenitore{getSortIndicator("container")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("lastLoadAt")} className="hover:text-slate-700">
                      Data ultimo carico{getSortIndicator("lastLoadAt")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">Giacenza attuale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {pagedRows.map((row) => (
                  <tr key={row.productId} className="text-slate-700">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.productCode}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.productName}</td>
                    <td className="px-4 py-3">{row.monthlyForecast ?? "-"}</td>
                    <td className="px-4 py-3">{containerLabels[row.container]}</td>
                    <td className="px-4 py-3">
                      {row.lastLoadAt ? dateFormatter.format(row.lastLoadAt) : "Nessun carico"}
                    </td>
                    <td className="px-4 py-3">{row.currentStock}</td>
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
