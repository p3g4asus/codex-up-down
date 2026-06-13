import { MovementType } from "@prisma/client";

import {
  buildArticlesWhere,
  buildArticlesRows,
  getArticlesSort,
  getArticlesSortDir,
  resolveArticlesReferenceDate,
  sortArticlesRows,
} from "@/lib/articoli-report";
import { containerLabels } from "@/lib/containers";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "short" });

function escapeCsv(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replaceAll('"', '""');
  return `"${normalized}"`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    productId: searchParams.get("productId") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    dir: searchParams.get("dir") ?? undefined,
  };

  const referenceDate = resolveArticlesReferenceDate(filters.date);

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

  const filterProductId = filters.productId ? Number(filters.productId) : NaN;
  if (Number.isInteger(filterProductId) && filterProductId > 0) {
    reportRows = reportRows.filter((row) => row.productId === filterProductId);
  }

  reportRows = sortArticlesRows(reportRows, getArticlesSort(filters), getArticlesSortDir(filters));

  const header = [
    "Codice articolo",
    "Nome articolo",
    "Vendita mensile prevista",
    "Contenitore",
    "Data ultimo carico",
    "Giacenza alla data attuale",
  ];

  const rows = reportRows.map((row) => [
    escapeCsv(row.productCode),
    escapeCsv(row.productName),
    escapeCsv(row.monthlyForecast),
    escapeCsv(containerLabels[row.container]),
    escapeCsv(row.lastLoadAt ? dateFormatter.format(row.lastLoadAt) : "Nessun carico"),
    escapeCsv(row.currentStock),
  ]);

  const csv = [header.map(escapeCsv).join(","), ...rows.map((row) => row.join(","))].join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-articoli-${timestamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
