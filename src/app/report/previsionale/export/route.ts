import { MovementType } from "@prisma/client";

import {
  buildForecastProductWhere,
  buildForecastRows,
  formatSignedPercent,
  getForecastSort,
  getForecastSortDir,
  getMissingUnitsToCoverMonth,
  resolveMonthContext,
  sortForecastRows,
} from "@/lib/previsionale-report";
import { prisma } from "@/lib/prisma";
import { unitLabels } from "@/lib/units";

const dateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "short" });

function escapeCsv(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replaceAll('"', '""');
  return `"${normalized}"`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    q: searchParams.get("q") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    productId: searchParams.get("productId") ?? undefined,
    coverage: searchParams.get("coverage") ?? undefined,
    trend: searchParams.get("trend") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    dir: searchParams.get("dir") ?? undefined,
  };

  const monthContext = resolveMonthContext(filters.month);

  const [products, monthlyUnloadedToReference, movementsAfterReferenceByType] = await Promise.all([
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
  ]);

  const unloadedToReferenceMap = new Map(monthlyUnloadedToReference.map((row) => [row.productId, row._sum.quantity ?? 0]));
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

  let reportRows = buildForecastRows(
    products,
    unloadedToReferenceMap,
    loadsAfterReferenceMap,
    unloadsAfterReferenceMap,
    monthContext,
  );

  const filterProductId = filters.productId ? Number(filters.productId) : NaN;
  if (Number.isInteger(filterProductId) && filterProductId > 0) {
    reportRows = reportRows.filter((row) => row.productId === filterProductId);
  }

  if (filters.coverage === "covered") {
    reportRows = reportRows.filter((row) => row.isCoverageSufficient === true);
  }

  if (filters.coverage === "uncovered") {
    reportRows = reportRows.filter((row) => row.isCoverageSufficient === false);
  }

  if (filters.trend === "above") {
    reportRows = reportRows.filter((row) => row.deltaPercent !== null && row.deltaPercent > 0);
  }

  if (filters.trend === "not-above") {
    reportRows = reportRows.filter((row) => row.deltaPercent !== null && row.deltaPercent <= 0);
  }

  reportRows = sortForecastRows(reportRows, getForecastSort(filters), getForecastSortDir(filters));

  const header = [
    "Codice articolo",
    "Articolo",
    "Vendita prevista mensile",
    "Giacenza attuale",
    "Stock necessario per coprire le vendite mensili",
    "Vendita effettiva",
    "Data esaurimento scorte",
    "Esito esaurimento",
    "Stock necessario per completare il mese",
    "Copertura stock",
    "Unita",
  ];

  const rows = reportRows.map((row) => {
    const depletionOutcome =
      row.depletionDate === null
        ? "Dati non sufficienti"
        : row.depletionDate > monthContext.monthEnd
          ? "Oltre fine mese"
          : isSameDay(row.depletionDate, monthContext.monthEnd)
            ? "A fine mese"
            : "Prima di fine mese";

    const missingUnits = getMissingUnitsToCoverMonth(row.stockNeededToMonthEnd, row.currentStockAtReference);

    return [
      escapeCsv(row.productCode),
      escapeCsv(row.productName),
      escapeCsv(row.monthlyForecast !== null ? Math.round(row.monthlyForecast) : "-"),
      escapeCsv(row.currentStockAtReference),
      escapeCsv(
        row.stockNeededForMonthlySales === null
          ? "Dati non sufficienti"
          : row.stockNeededForMonthlySales < 0
            ? "Vendita superiore al previsto"
            : Math.round(row.stockNeededForMonthlySales),
      ),
      escapeCsv(`${Math.round(row.unloadedToReference)} (${formatSignedPercent(row.deltaPercent)})`),
      escapeCsv(row.depletionDate ? dateFormatter.format(row.depletionDate) : "Dati non sufficienti"),
      escapeCsv(depletionOutcome),
      escapeCsv(
        row.stockNeededToMonthEnd !== null
          ? `${Math.round(row.stockNeededToMonthEnd)}${
              row.isCoverageSufficient === false && missingUnits !== null ? ` (Mancano ${missingUnits})` : ""
            }`
          : "Dati non sufficienti",
      ),
      escapeCsv(
        row.isCoverageSufficient === null
          ? "Dati non sufficienti"
          : row.isCoverageSufficient
            ? "Copertura sufficiente"
            : "Copertura insufficiente",
      ),
      escapeCsv(unitLabels[row.unit]),
    ];
  });

  const csv = [header.map(escapeCsv).join(","), ...rows.map((row) => row.join(","))].join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-previsionale-${timestamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
