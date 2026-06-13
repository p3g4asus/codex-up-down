import { MovementType } from "@prisma/client";

import { FeedbackBanner } from "@/components/feedback-banner";
import { HistoryFiltersForm } from "@/components/history-filters-form";
import { PageShell } from "@/components/page-shell";
import { MovementRowActions } from "@/components/movement-row-actions";
import { PrintButton } from "@/components/print-button";
import {
  getHistoryPage,
  getHistoryPageSize,
  getHistoryOrderBy,
  getHistorySort,
  getHistorySortDir,
  buildHistorySearchParams,
  buildHistoryWhere,
  movementTypeLabels,
  type HistoryFilterParams,
} from "@/lib/history";
import { withBasePath } from "@/lib/base-path";
import { prisma } from "@/lib/prisma";
import { unitLabels } from "@/lib/units";

type PageProps = {
  searchParams?: Promise<HistoryFilterParams>;
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function HistoryPage({ searchParams }: PageProps) {
  const filters = searchParams ? await searchParams : undefined;
  const currentPage = getHistoryPage(filters);
  const pageSize = getHistoryPageSize(filters);
  const sort = getHistorySort(filters);
  const dir = getHistorySortDir(filters);
  const where = buildHistoryWhere(filters);
  const orderBy = getHistoryOrderBy(filters);

  const [products, totalCount, groupedTotals, movements, latestMovementsByProduct] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.movement.count({ where }),
    prisma.movement.groupBy({
      by: ["type"],
      where,
      _sum: {
        quantity: true,
      },
    }),
    prisma.movement.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      include: {
        product: true,
      },
    }),
    prisma.movement.findMany({
      orderBy: [{ productId: "asc" }, { createdAt: "desc" }, { id: "desc" }],
      distinct: ["productId"],
      select: {
        id: true,
        productId: true,
        createdAt: true,
      },
    }),
  ]);

  const latestMovementByProduct = new Map(
    latestMovementsByProduct.map((movement) => [movement.productId, movement]),
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const selectedProductName = filters?.productId
    ? products.find((product) => product.id === Number(filters.productId))?.name ?? null
    : null;
  const searchLabel = filters?.q?.trim() ? `Ricerca: ${filters.q.trim()}` : null;
  const typeLabel =
    filters?.type === MovementType.LOAD
      ? "Tipo: Carico"
      : filters?.type === MovementType.UNLOAD
        ? "Tipo: Scarico"
        : null;
  const dateFromLabel = filters?.dateFrom ? `Dal: ${dateFormatter.format(new Date(`${filters.dateFrom}T00:00:00`))}` : null;
  const dateToLabel = filters?.dateTo ? `Al: ${dateFormatter.format(new Date(`${filters.dateTo}T00:00:00`))}` : null;
  const activePageSizeLabel = pageSize !== 12 ? `Righe per pagina: ${pageSize}` : null;
  const hasActiveFilters = Boolean(filters?.q?.trim() || filters?.productId || filters?.type || filters?.dateFrom || filters?.dateTo);

  const totalLoaded = groupedTotals.find((group) => group.type === MovementType.LOAD)?._sum.quantity ?? 0;
  const totalUnloaded = groupedTotals.find((group) => group.type === MovementType.UNLOAD)?._sum.quantity ?? 0;

  function buildPageHref(page: number) {
    const query = buildHistorySearchParams({ ...filters, page: String(page) });
    return query ? `${withBasePath("/storico")}?${query}` : withBasePath("/storico");
  }

  function buildSortHref(nextSort: string) {
    const nextDir = sort === nextSort && dir === "asc" ? "desc" : "asc";
    const query = buildHistorySearchParams({
      ...filters,
      sort: nextSort,
      dir: nextDir,
      page: "1",
    });
    return query ? `${withBasePath("/storico")}?${query}` : withBasePath("/storico");
  }

  function getSortIndicator(column: string) {
    if (sort !== column) {
      return "";
    }

    return dir === "asc" ? " ↑" : " ↓";
  }

  return (
    <PageShell
      title="Report storico"
      description="Consulta lo storico dei movimenti, applica i filtri e verifica carichi e scarichi del periodo selezionato."
    >
      <FeedbackBanner kind={filters?.kind} message={filters?.message} />
      <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <HistoryFiltersForm filters={filters} pageSize={pageSize} products={products} sort={sort} dir={dir} />
          <PrintButton label="Stampa report storico" />
        </div>
      </section>

      <section className="mt-6 space-y-6 print:mt-0">
        {totalCount > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:shadow-none print:border-slate-200">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Movimenti trovati</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{totalCount}</p>
            </article>
            <article className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:shadow-none print:border-slate-200">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Totale caricato</p>
              <p className="mt-3 text-4xl font-semibold text-emerald-700">{totalLoaded}</p>
            </article>
            <article className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:shadow-none print:border-slate-200">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Totale scaricato</p>
              <p className="mt-3 text-4xl font-semibold text-amber-700">{totalUnloaded}</p>
            </article>
          </div>
        ) : null}

        <div className="report-print rounded-[2rem] border border-white/70 bg-[var(--card)] shadow-panel backdrop-blur print:rounded-none print:border-0 print:bg-white print:shadow-none">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-5 print:px-0">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Report storico</h2>
              <p className="mt-1 text-sm text-slate-600">
                Generato il {dateFormatter.format(new Date())}
              </p>
              {hasActiveFilters ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 print:bg-white">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
                    {searchLabel ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-amber-800">{searchLabel}</span>
                    ) : null}
                    {selectedProductName ? (
                      <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sky-800">
                        Articolo: {selectedProductName}
                      </span>
                    ) : null}
                    {typeLabel ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{typeLabel}</span>
                    ) : null}
                    {dateFromLabel ? (
                      <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-violet-800">{dateFromLabel}</span>
                    ) : null}
                    {dateToLabel ? (
                      <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-violet-800">{dateToLabel}</span>
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
          </div>
          {movements.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-600 print:px-0">
              Nessun dato disponibile con i filtri selezionati.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-white/60 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Codice articolo</th>
                    <th className="px-6 py-4 font-medium print:px-0">
                      <a href={buildSortHref("createdAt")} className="hover:text-slate-700">
                        Data{getSortIndicator("createdAt")}
                      </a>
                    </th>
                    <th className="px-6 py-4 font-medium">
                      <a href={buildSortHref("product")} className="hover:text-slate-700">
                        Articolo{getSortIndicator("product")}
                      </a>
                    </th>
                    <th className="px-6 py-4 font-medium">
                      <a href={buildSortHref("type")} className="hover:text-slate-700">
                        Tipo{getSortIndicator("type")}
                      </a>
                    </th>
                    <th className="px-6 py-4 font-medium">
                      <a href={buildSortHref("quantity")} className="hover:text-slate-700">
                        Quantità{getSortIndicator("quantity")}
                      </a>
                    </th>
                    <th className="px-6 py-4 font-medium">Unità</th>
                    <th className="px-6 py-4 font-medium">Nota</th>
                    <th className="px-6 py-4 font-medium print:hidden">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {movements.map((movement) => {
                    const latestMovement = latestMovementByProduct.get(movement.productId);
                    const canEditOrDelete = latestMovement?.id === movement.id;
                    const requiresProtectedCode =
                      canEditOrDelete && Date.now() - movement.createdAt.getTime() > 5 * 60 * 1000;

                    return (
                      <tr key={movement.id} className="align-top text-slate-700">
                          <td className="px-6 py-4 font-semibold text-slate-900">{movement.product.code ?? "-"}</td>
                        <td className="px-6 py-4 print:px-0">{dateFormatter.format(movement.createdAt)}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{movement.product.name}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              movement.type === MovementType.LOAD
                                ? "bg-emerald-100 text-emerald-900"
                                : "bg-amber-100 text-amber-900"
                            } print:border print:border-slate-300 print:bg-white print:text-slate-900`}
                          >
                            {movementTypeLabels[movement.type]}
                          </span>
                        </td>
                        <td className="px-6 py-4">{movement.quantity}</td>
                        <td className="px-6 py-4 text-slate-600">{unitLabels[movement.product.unit]}</td>
                        <td className="px-6 py-4 text-slate-600">{movement.note || "-"}</td>
                        <td className="px-6 py-4 print:hidden">
                          <MovementRowActions
                            movementId={movement.id}
                            productName={movement.product.name}
                            quantity={movement.quantity}
                            canEditOrDelete={canEditOrDelete}
                            requiresProtectedCode={requiresProtectedCode}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalCount > 0 ? (
          <div className="flex flex-col gap-3 rounded-[2rem] border border-white/70 bg-[var(--card)] p-5 shadow-panel backdrop-blur md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-600">
              Pagina {safeCurrentPage} di {totalPages}. Visualizzati {movements.length} movimenti su {totalCount}, con {pageSize} righe per pagina.
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
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
