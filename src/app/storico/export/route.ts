import { prisma } from "@/lib/prisma";
import { buildHistoryWhere, movementTypeLabels } from "@/lib/history";
import {
  buildMonthlyReportRows,
  formatMonthlyDelta,
  getCurrentMonthRange,
} from "@/lib/monthly-report";
import { unitLabels } from "@/lib/units";

const csvDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
});

function escapeCsv(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replaceAll('"', '""');
  return `"${normalized}"`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    q: searchParams.get("q") ?? undefined,
    productId: searchParams.get("productId") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  };

  const movements = await prisma.movement.findMany({
    where: buildHistoryWhere(filters),
    orderBy: { createdAt: "desc" },
    include: {
      product: true,
    },
  });

  const currentMonthRange = getCurrentMonthRange();
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
  });
  const monthlyUnloadedTotals = await prisma.movement.groupBy({
    by: ["productId"],
    where: {
      type: "UNLOAD",
      createdAt: {
        gte: currentMonthRange.start,
        lte: currentMonthRange.end,
      },
    },
    _sum: {
      quantity: true,
    },
  });
  const monthlyReportRows = buildMonthlyReportRows(
    products,
    new Map(monthlyUnloadedTotals.map((row) => [row.productId, row._sum.quantity ?? 0])),
  );

  const summaryHeader = [
    "Riepilogo mensile per merce",
    "Merce",
    "Previsto al giorno corrente",
    "Scaricato nel mese",
    "Scostamento",
    "Esito scostamento",
    "Unita",
  ];
  const summaryRows = monthlyReportRows.map((row) => [
    escapeCsv("Riepilogo mensile per merce"),
    escapeCsv(row.productName),
    escapeCsv(row.expectedSoldToDate?.toFixed(2) ?? "-"),
    escapeCsv(row.unloadedInMonth),
    escapeCsv(formatMonthlyDelta(row.delta)),
    escapeCsv(
      row.delta === null
        ? "Nessun dato"
        : row.delta > 0
          ? "Sopra attese"
          : row.delta < 0
            ? "Sotto attese"
            : "In linea",
    ),
    escapeCsv(unitLabels[row.unit]),
  ]);

  const header = ["Codice articolo", "Data", "Merce", "Tipo", "Quantita", "Unita", "Nota"];
  const rows = movements.map((movement) => [
    escapeCsv(movement.product.code ?? ""),
    escapeCsv(csvDateFormatter.format(movement.createdAt)),
    escapeCsv(movement.product.name),
    escapeCsv(movementTypeLabels[movement.type]),
    escapeCsv(movement.quantity),
    escapeCsv(unitLabels[movement.product.unit]),
    escapeCsv(movement.note ?? ""),
  ]);

  const csv = [
    summaryHeader.map(escapeCsv).join(","),
    ...summaryRows.map((row) => row.join(",")),
    "",
    header.map(escapeCsv).join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="storico-magazzino-${timestamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
