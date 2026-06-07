import { MovementType } from "@prisma/client";

import {
  buildArticlesRows,
  getArticlesSort,
  getArticlesSortDir,
  resolveArticlesReferenceDate,
  sortArticlesRows,
} from "@/lib/articoli-report";
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

  const filterProductId = filters.productId ? Number(filters.productId) : NaN;
  if (Number.isInteger(filterProductId) && filterProductId > 0) {
    reportRows = reportRows.filter((row) => row.productId === filterProductId);
  }

  reportRows = sortArticlesRows(reportRows, getArticlesSort(filters), getArticlesSortDir(filters));

  const header = ["Articolo", "Giacenza alla data attuale", "Data ultimo carico"];

  const rows = reportRows.map((row) => [
    escapeCsv(row.productName),
    escapeCsv(row.stockAtReference),
    escapeCsv(row.lastLoadAt ? dateFormatter.format(row.lastLoadAt) : "Nessun carico"),
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
