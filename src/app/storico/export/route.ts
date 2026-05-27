import { prisma } from "@/lib/prisma";
import { buildHistoryWhere, movementTypeLabels } from "@/lib/history";
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

  const header = ["Data", "Merce", "Tipo", "Quantita", "Unita", "Nota"];
  const rows = movements.map((movement) => [
    escapeCsv(csvDateFormatter.format(movement.createdAt)),
    escapeCsv(movement.product.name),
    escapeCsv(movementTypeLabels[movement.type]),
    escapeCsv(movement.quantity),
    escapeCsv(unitLabels[movement.product.unit]),
    escapeCsv(movement.note ?? ""),
  ]);

  const csv = [header.map(escapeCsv).join(","), ...rows.map((row) => row.join(","))].join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="storico-magazzino-${timestamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
