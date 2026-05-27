import { MovementType } from "@prisma/client";

import { PageShell } from "@/components/page-shell";
import { PrintButton } from "@/components/print-button";
import {
  HISTORY_PAGE_SIZE_OPTIONS,
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
  const exportQuery = buildHistorySearchParams({ ...filters, page: undefined });
  const where = buildHistoryWhere(filters);
  const orderBy = getHistoryOrderBy(filters);

  const [products, totalCount, groupedTotals, movements] = await Promise.all([
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
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const totalLoaded = groupedTotals.find((group) => group.type === MovementType.LOAD)?._sum.quantity ?? 0;
  const totalUnloaded = groupedTotals.find((group) => group.type === MovementType.UNLOAD)?._sum.quantity ?? 0;

  function buildPageHref(page: number) {
    const query = buildHistorySearchParams({ ...filters, page: String(page) });
    return query ? `/storico?${query}` : "/storico";
  }

  function buildSortHref(nextSort: string) {
    const nextDir = sort === nextSort && dir === "asc" ? "desc" : "asc";
    const query = buildHistorySearchParams({
      ...filters,
      sort: nextSort,
      dir: nextDir,
      page: "1",
    });
    return query ? `/storico?${query}` : "/storico";
  }

  function getSortIndicator(column: string) {
    if (sort !== column) {
      return "";
    }

    return dir === "asc" ? " ↑" : " ↓";
  }

  return (
    <PageShell
      title="Storico movimenti"
      description="Consulta lo storico di carico e scarico, applica filtri per merce, tipo e intervallo date, quindi stampa un report pulito da archiviare o condividere."
    >
      <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <form className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <label htmlFor="q" className="text-sm font-semibold text-slate-900">
                Cerca merce
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filters?.q ?? ""}
                placeholder="Nome, descrizione o nota"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="productId" className="text-sm font-semibold text-slate-900">
                Merce
              </label>
              <select
                id="productId"
                name="productId"
                defaultValue={filters?.productId ?? ""}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
              >
                <option value="">Tutte le merci</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="type" className="text-sm font-semibold text-slate-900">
                Tipo movimento
              </label>
              <select
                id="type"
                name="type"
                defaultValue={filters?.type ?? ""}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
              >
                <option value="">Tutti i movimenti</option>
                <option value={MovementType.LOAD}>Carico</option>
                <option value={MovementType.UNLOAD}>Scarico</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="dateFrom" className="text-sm font-semibold text-slate-900">
                Dal giorno
              </label>
              <input
                id="dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={filters?.dateFrom ?? ""}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="dateTo" className="text-sm font-semibold text-slate-900">
                Al giorno
              </label>
              <input
                id="dateTo"
                name="dateTo"
                type="date"
                defaultValue={filters?.dateTo ?? ""}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="pageSize" className="text-sm font-semibold text-slate-900">
                Righe per pagina
              </label>
              <select
                id="pageSize"
                name="pageSize"
                defaultValue={String(pageSize)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
              >
                {HISTORY_PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 md:col-span-2 xl:col-span-6">
              <button
                type="submit"
                className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong"
              >
                Applica filtri
              </button>
              <a
                href="/storico"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                Azzera
              </a>
              <a
                href={exportQuery ? `/storico/export?${exportQuery}` : "/storico/export"}
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                Esporta CSV
              </a>
              <a
                href={exportQuery ? `/storico/export/pdf?${exportQuery}` : "/storico/export/pdf"}
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                Esporta PDF
              </a>
            </div>
          </form>
          <PrintButton />
        </div>
      </section>

      <section className="mt-6 space-y-6 print:mt-0">
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

        <div className="report-print rounded-[2rem] border border-white/70 bg-[var(--card)] shadow-panel backdrop-blur print:rounded-none print:border-0 print:bg-white print:shadow-none">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-5 print:px-0">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Report movimenti</h2>
              <p className="mt-1 text-sm text-slate-600">
                Generato il {dateFormatter.format(new Date())}
              </p>
            </div>
          </div>
          {movements.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-600 print:px-0">
              Nessun movimento trovato con i filtri attuali.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-white/60 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium print:px-0">
                      <a href={buildSortHref("createdAt")} className="hover:text-slate-700">
                        Data{getSortIndicator("createdAt")}
                      </a>
                    </th>
                    <th className="px-6 py-4 font-medium">
                      <a href={buildSortHref("product")} className="hover:text-slate-700">
                        Merce{getSortIndicator("product")}
                      </a>
                    </th>
                    <th className="px-6 py-4 font-medium">
                      <a href={buildSortHref("type")} className="hover:text-slate-700">
                        Tipo{getSortIndicator("type")}
                      </a>
                    </th>
                    <th className="px-6 py-4 font-medium">
                      <a href={buildSortHref("quantity")} className="hover:text-slate-700">
                        Quantita{getSortIndicator("quantity")}
                      </a>
                    </th>
                    <th className="px-6 py-4 font-medium">Unita</th>
                    <th className="px-6 py-4 font-medium">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="align-top text-slate-700">
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
                    </tr>
                  ))}
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
