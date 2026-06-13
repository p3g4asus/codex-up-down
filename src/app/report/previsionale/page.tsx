import { MovementType } from "@prisma/client";

import { ForecastFiltersForm } from "@/components/forecast-filters-form";
import { PageShell } from "@/components/page-shell";
import { PrintButton } from "@/components/print-button";
import {
  buildForecastSearchParams,
  buildForecastProductWhere,
  buildForecastRows,
  formatSignedPercent,
  getForecastPage,
  getForecastPageSize,
  getForecastSort,
  getForecastSortDir,
  getMissingUnitsToCoverMonth,
  type ForecastFilterParams,
  resolveMonthContext,
  sortForecastRows,
  type ForecastRow,
} from "@/lib/previsionale-report";
import { withBasePath } from "@/lib/base-path";
import { prisma } from "@/lib/prisma";
import { unitLabels } from "@/lib/units";

type PageProps = {
  searchParams?: Promise<ForecastFilterParams>;
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
});

const monthLabelFormatter = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
});

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function depletionTone(row: ForecastRow, monthEnd: Date) {
  if (!row.depletionDate) {
    return "neutral" as const;
  }

  if (row.depletionDate > monthEnd) {
    return "good" as const;
  }

  if (isSameDay(row.depletionDate, monthEnd)) {
    return "neutral" as const;
  }

  return "bad" as const;
}

export default async function ForecastReportPage({ searchParams }: PageProps) {
  const filters = searchParams ? await searchParams : undefined;
  const currentPage = getForecastPage(filters);
  const pageSize = getForecastPageSize(filters);
  const sort = getForecastSort(filters);
  const dir = getForecastSortDir(filters);
  const monthContext = resolveMonthContext(filters?.month);

  const [products, monthlyUnloadedToReference, movementsAfterReferenceByType, earliestMovement] = await Promise.all([
    prisma.product.findMany({
      where: buildForecastProductWhere(filters),
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        stock: true,
        alertThreshold: true,
      },
    }),
    prisma.movement.groupBy({
      by: ["productId"],
      where: {
        type: MovementType.UNLOAD,
        createdAt: {
          gte: monthContext.monthStart,
          lte: monthContext.referenceDate,
        },
      },
      _sum: {
        quantity: true,
      },
    }),
    prisma.movement.groupBy({
      by: ["productId", "type"],
      where: {
        createdAt: {
          gt: monthContext.referenceDate,
        },
      },
      _sum: {
        quantity: true,
      },
    }),
    prisma.movement.findFirst({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstMonthStart = earliestMovement
    ? new Date(earliestMovement.createdAt.getFullYear(), earliestMovement.createdAt.getMonth(), 1)
    : currentMonthStart;
  const monthOptions: Array<{ value: string; label: string }> = [];
  const cursor = new Date(currentMonthStart);
  while (cursor >= firstMonthStart) {
    const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const label = monthLabelFormatter.format(cursor).replace(/^./, (char) => char.toUpperCase());
    monthOptions.push({ value, label });
    cursor.setMonth(cursor.getMonth() - 1);
  }

  const unloadedToReferenceMap = new Map(monthlyUnloadedToReference.map((row) => [row.productId, row._sum.quantity ?? 0]));
  const loadsAfterReferenceMap = new Map<number, number>();
  const unloadsAfterReferenceMap = new Map<number, number>();
  const selectedProductName = filters?.productId
    ? products.find((product) => product.id === Number(filters.productId))?.name ?? null
    : null;
  const activeSearchLabel = filters?.q?.trim() ? `Ricerca: ${filters.q.trim()}` : null;
  const selectedMonthLabel = filters?.month
    ? monthLabelFormatter.format(monthContext.monthStart)
    : "Mese: corrente";
  const selectedCoverageLabel =
    filters?.coverage === "covered"
      ? "Copertura: sufficiente"
      : filters?.coverage === "uncovered"
        ? "Copertura: insufficiente"
        : null;
  const selectedTrendLabel =
    filters?.trend === "above"
      ? "Trend: più vendite del previsto"
      : filters?.trend === "not-above"
        ? "Trend: non più vendite del previsto"
        : null;
  const activePageSizeLabel = pageSize !== 12 ? `Righe per pagina: ${pageSize}` : null;
  const hasActiveFilters = Boolean(filters?.q?.trim() || filters?.month || filters?.productId || filters?.coverage || filters?.trend);

  for (const row of movementsAfterReferenceByType) {
    if (row.type === MovementType.LOAD) {
      loadsAfterReferenceMap.set(row.productId, row._sum.quantity ?? 0);
    }

    if (row.type === MovementType.UNLOAD) {
      unloadsAfterReferenceMap.set(row.productId, row._sum.quantity ?? 0);
    }
  }

  let reportRows = buildForecastRows(
    products,
    unloadedToReferenceMap,
    loadsAfterReferenceMap,
    unloadsAfterReferenceMap,
    monthContext,
  );

  const filterProductId = filters?.productId ? Number(filters.productId) : NaN;
  if (Number.isInteger(filterProductId) && filterProductId > 0) {
    reportRows = reportRows.filter((row) => row.productId === filterProductId);
  }

  if (filters?.coverage === "covered") {
    reportRows = reportRows.filter((row) => row.isCoverageSufficient === true);
  }

  if (filters?.coverage === "uncovered") {
    reportRows = reportRows.filter((row) => row.isCoverageSufficient === false);
  }

  if (filters?.trend === "above") {
    reportRows = reportRows.filter((row) => row.deltaPercent !== null && row.deltaPercent > 0);
  }

  if (filters?.trend === "not-above") {
    reportRows = reportRows.filter((row) => row.deltaPercent !== null && row.deltaPercent <= 0);
  }

  reportRows = sortForecastRows(reportRows, sort, dir);

  const totalCount = reportRows.length;
  const coveredCount = reportRows.filter((row) => row.isCoverageSufficient === true).length;
  const uncoveredCount = reportRows.filter((row) => row.isCoverageSufficient === false).length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedRows = reportRows.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  function buildPageHref(page: number) {
    const query = buildForecastSearchParams({ ...filters, page: String(page), pageSize: String(pageSize), sort, dir });
    return query ? `${withBasePath("/report/previsionale")}?${query}` : withBasePath("/report/previsionale");
  }

  function buildSortHref(nextSort: string) {
    const nextDir = sort === nextSort && dir === "asc" ? "desc" : "asc";
    const query = buildForecastSearchParams({
      ...filters,
      sort: nextSort,
      dir: nextDir,
      page: "1",
      pageSize: String(pageSize),
    });
    return query ? `${withBasePath("/report/previsionale")}?${query}` : withBasePath("/report/previsionale");
  }

  function getSortIndicator(column: string) {
    if (sort !== column) {
      return "";
    }

    return dir === "asc" ? " ↑" : " ↓";
  }

  return (
    <PageShell
      title="Report previsionale"
      description="Consulta il report previsionale, applica i filtri e confronta vendite previste, vendite reali e copertura a fine mese."
    >
      <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <ForecastFiltersForm
            filters={filters}
            products={products.map((product) => ({ id: product.id, code: product.code ?? "", name: product.name }))}
            monthOptions={monthOptions}
            pageSize={pageSize}
            sort={sort}
            dir={dir}
          />
          <PrintButton label="Stampa report previsionale" />
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/70 bg-[var(--card)] shadow-panel backdrop-blur print:rounded-none print:border-0 print:bg-white print:shadow-none">
        <div className="border-b border-slate-200/70 px-6 py-5 print:px-0">
          <h2 className="text-xl font-semibold text-slate-950">Report previsionale</h2>
          <p className="mt-1 text-sm text-slate-600">
            Mese di riferimento: {monthContext.monthLabel}. Data attuale di calcolo: {dateFormatter.format(monthContext.referenceDate)}.
          </p>
          {hasActiveFilters ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
                {activeSearchLabel ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                    {activeSearchLabel}
                  </span>
                ) : null}
                <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sky-800">{selectedMonthLabel}</span>
                {selectedProductName ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                    Articolo: {selectedProductName}
                  </span>
                ) : null}
                {selectedCoverageLabel ? (
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                    {selectedCoverageLabel}
                  </span>
                ) : null}
                {selectedTrendLabel ? (
                  <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-violet-800">
                    {selectedTrendLabel}
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
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Copertura sufficiente</p>
              <p className="mt-3 text-4xl font-semibold text-emerald-700">{coveredCount}</p>
            </article>
            <article className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:shadow-none print:border-slate-200">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Copertura insufficiente</p>
              <p className="mt-3 text-4xl font-semibold text-amber-700">{uncoveredCount}</p>
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
                    <th className="px-4 py-3 font-medium">Codice articolo</th>
                    <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("product")} className="hover:text-slate-700">
                      Articolo{getSortIndicator("product")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("monthlyForecast")} className="hover:text-slate-700">
                      Vendita prevista mensile{getSortIndicator("monthlyForecast")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("currentStock")} className="hover:text-slate-700">
                      Giacenza attuale{getSortIndicator("currentStock")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">Stock necessario per coprire le vendite mensili</th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("unloadedToReference")} className="hover:text-slate-700">
                      Vendita effettiva{getSortIndicator("unloadedToReference")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("depletionDate")} className="hover:text-slate-700">
                      Data esaurimento scorte{getSortIndicator("depletionDate")}
                    </a>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <a href={buildSortHref("stockNeededToMonthEnd")} className="hover:text-slate-700">
                      Stock necessario per completare il mese{getSortIndicator("stockNeededToMonthEnd")}
                    </a>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {pagedRows.map((row) => {
                  const deltaTone =
                    row.deltaPercent === null
                      ? "text-slate-500"
                      : row.deltaPercent > 0
                        ? "text-emerald-700"
                        : row.deltaPercent < 0
                          ? "text-rose-700"
                          : "text-slate-900";
                  const depletionStatus = depletionTone(row, monthContext.monthEnd);
                  const depletionClass =
                    depletionStatus === "good"
                      ? "bg-emerald-100 text-emerald-800"
                      : depletionStatus === "bad"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-100 text-slate-700";
                  const stockCoverageClass =
                    row.isCoverageSufficient === null
                      ? "bg-slate-100 text-slate-700"
                      : row.isCoverageSufficient
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800";
                  const missingUnits = getMissingUnitsToCoverMonth(
                    row.stockNeededToMonthEnd,
                    row.currentStockAtReference,
                  );
                  const stockNeededForMonthlySales = row.stockNeededForMonthlySales;
                  const isOverMonthlyForecast =
                    stockNeededForMonthlySales !== null && stockNeededForMonthlySales < 0;
                  const stockNeededForMonthlySalesTone =
                    stockNeededForMonthlySales !== null && stockNeededForMonthlySales >= 0
                      ? stockNeededForMonthlySales <= row.currentStockAtReference
                        ? "text-emerald-700"
                        : "text-rose-700"
                      : "text-slate-700";

                  return (
                    <tr key={row.productId} className="text-slate-700">
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.productCode}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.productName}</td>
                      <td className="px-4 py-3">{row.monthlyForecast !== null ? Math.round(row.monthlyForecast) : "-"}</td>
                      <td className="px-4 py-3">{row.currentStockAtReference} {unitLabels[row.unit]}</td>
                      <td className="px-4 py-3">
                        {stockNeededForMonthlySales === null ? (
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            Dati non sufficienti
                          </span>
                        ) : isOverMonthlyForecast ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            Vendita superiore al previsto
                          </span>
                        ) : (
                          <span className={`font-semibold ${stockNeededForMonthlySalesTone}`}>
                            {Math.round(stockNeededForMonthlySales)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <span className="text-slate-900">{Math.round(row.unloadedToReference)}</span>
                        <span className={`ml-1 ${deltaTone}`}>
                          ({formatSignedPercent(row.deltaPercent)})
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.depletionDate ? (
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${depletionClass}`}>
                            {dateFormatter.format(row.depletionDate)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            Dati non sufficienti
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.stockNeededToMonthEnd !== null ? (
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stockCoverageClass}`}>
                            {Math.round(row.stockNeededToMonthEnd)}
                            {row.isCoverageSufficient === false && missingUnits !== null
                              ? ` (Mancano ${missingUnits})`
                              : ""}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            Dati non sufficienti
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
