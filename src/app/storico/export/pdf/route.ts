import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

import { buildHistoryWhere, movementTypeLabels } from "@/lib/history";
import {
  buildMonthlyReportRows,
  formatMonthlyDelta,
  getCurrentMonthRange,
} from "@/lib/monthly-report";
import { prisma } from "@/lib/prisma";
import { unitLabels } from "@/lib/units";

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatFilterLabel(label: string, value?: string | null) {
  return `${label}: ${value && value.trim() ? value.trim() : "Tutti"}`;
}

function toPdfColor(hex: string) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  return rgb(red, green, blue);
}

function topY(pageHeight: number, yTop: number, fontSize = 0) {
  return pageHeight - yTop - fontSize;
}

function estimateWrappedHeight(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const width = font.widthOfTextAtSize(text || "-", fontSize);
  return Math.max(fontSize * 1.2, Math.ceil(width / maxWidth) * fontSize * 1.2);
}

function drawTableHeader(page: PDFPage, fonts: { bold: PDFFont }, yTop: number) {
  const y = topY(page.getHeight(), yTop, 10);

  page.drawText("Data", { x: MARGIN, y, size: 10, font: fonts.bold, color: toPdfColor("#334155") });
  page.drawText("Merce", { x: 120, y, size: 10, font: fonts.bold, color: toPdfColor("#334155") });
  page.drawText("Tipo", { x: 275, y, size: 10, font: fonts.bold, color: toPdfColor("#334155") });
  page.drawText("Qta", { x: 330, y, size: 10, font: fonts.bold, color: toPdfColor("#334155") });
  page.drawText("Unita", { x: 380, y, size: 10, font: fonts.bold, color: toPdfColor("#334155") });
  page.drawText("Nota", { x: 450, y, size: 10, font: fonts.bold, color: toPdfColor("#334155") });

  page.drawLine({
    start: { x: MARGIN, y: page.getHeight() - yTop - 16 },
    end: { x: PAGE_WIDTH - MARGIN, y: page.getHeight() - yTop - 16 },
    thickness: 1,
    color: toPdfColor("#CBD5E1"),
  });
}

function drawMonthlySummaryHeader(page: PDFPage, fonts: { bold: PDFFont }, yTop: number) {
  const y = topY(page.getHeight(), yTop, 10);

  page.drawText("Merce", { x: MARGIN, y, size: 10, font: fonts.bold, color: toPdfColor("#334155") });
  page.drawText("Previsto al giorno corrente", { x: 220, y, size: 10, font: fonts.bold, color: toPdfColor("#334155") });
  page.drawText("Scaricato nel mese", { x: 370, y, size: 10, font: fonts.bold, color: toPdfColor("#334155") });
  page.drawText("Scostamento", { x: 490, y, size: 10, font: fonts.bold, color: toPdfColor("#334155") });

  page.drawLine({
    start: { x: MARGIN, y: page.getHeight() - yTop - 16 },
    end: { x: PAGE_WIDTH - MARGIN, y: page.getHeight() - yTop - 16 },
    thickness: 1,
    color: toPdfColor("#CBD5E1"),
  });
}

function drawMonthlyDeltaBadge(page: PDFPage, delta: number | null, x: number, yTop: number, fonts: { regular: PDFFont; bold: PDFFont }) {
  const label =
    delta === null
      ? "-"
      : delta > 0
        ? `Sopra attese ${formatMonthlyDelta(delta)}`
        : delta < 0
          ? `Sotto attese ${formatMonthlyDelta(delta)}`
          : "In linea 0";
  const fill =
    delta === null
      ? "#F1F5F9"
      : delta > 0
        ? "#DCFCE7"
        : "#FEE2E2";
  const textColor =
    delta === null
      ? "#475569"
      : delta > 0
        ? "#166534"
        : "#B91C1C";
  const badgeWidth = delta === null ? 18 : delta > 0 ? 112 : delta < 0 ? 112 : 70;
  const badgeHeight = 14;
  const badgeY = page.getHeight() - yTop - badgeHeight + 2;

  page.drawRectangle({
    x,
    y: badgeY,
    width: badgeWidth,
    height: badgeHeight,
    color: toPdfColor(fill),
    borderColor: toPdfColor(fill),
    borderWidth: 1,
  });

  page.drawText(label, {
    x: x + 4,
    y: badgeY + 3,
    size: 8,
    font: fonts.bold,
    color: toPdfColor(textColor),
  });
}

function drawPageFooter(page: PDFPage, fonts: { regular: PDFFont }, pageNumber: number, totalPages: number) {
  page.drawLine({
    start: { x: MARGIN, y: 32 },
    end: { x: PAGE_WIDTH - MARGIN, y: 32 },
    thickness: 1,
    color: toPdfColor("#E2E8F0"),
  });

  page.drawText(`Pagina ${pageNumber} di ${totalPages}`, {
    x: MARGIN,
    y: 18,
    size: 9,
    font: fonts.regular,
    color: toPdfColor("#64748B"),
  });
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

  const totalLoaded = movements
    .filter((movement) => movement.type === "LOAD")
    .reduce((total, movement) => total + movement.quantity, 0);
  const totalUnloaded = movements
    .filter((movement) => movement.type === "UNLOAD")
    .reduce((total, movement) => total + movement.quantity, 0);

  const pdf = await PDFDocument.create();
  pdf.setTitle("Storico magazzino");
  pdf.setAuthor("codex-up-down");

  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yTop = 40;

  page.drawText("Storico magazzino", {
    x: MARGIN,
    y: topY(page.getHeight(), yTop, 20),
    size: 20,
    font: helveticaBold,
    color: toPdfColor("#0F172A"),
  });
  yTop += 28;
  page.drawText(`Generato il ${dateFormatter.format(new Date())}`, {
    x: MARGIN,
    y: topY(page.getHeight(), yTop, 10),
    size: 10,
    font: helvetica,
    color: toPdfColor("#475569"),
  });
  yTop += 24;

  const filterLines = [
    formatFilterLabel("Ricerca", filters.q),
    formatFilterLabel("Merce ID", filters.productId),
    formatFilterLabel(
      "Tipo",
      filters.type ? movementTypeLabels[filters.type as keyof typeof movementTypeLabels] : undefined,
    ),
    formatFilterLabel("Dal", filters.dateFrom),
    formatFilterLabel("Al", filters.dateTo),
  ];

  for (const line of filterLines) {
    page.drawText(line, {
      x: MARGIN,
      y: topY(page.getHeight(), yTop, 10),
      size: 10,
      font: helvetica,
      color: toPdfColor("#334155"),
    });
    yTop += 14;
  }

  yTop += 10;

  const summaryCards = [
    { x: 40, fill: "#ECFDF5", stroke: "#A7F3D0", label: "Totale caricato", value: String(totalLoaded), color: "#065F46" },
    { x: 215, fill: "#FFFBEB", stroke: "#FDE68A", label: "Totale scaricato", value: String(totalUnloaded), color: "#92400E" },
    { x: 390, fill: "#F8FAFC", stroke: "#CBD5E1", label: "Movimenti trovati", value: String(movements.length), color: "#0F172A" },
  ];

  for (const card of summaryCards) {
    page.drawRectangle({
      x: card.x,
      y: page.getHeight() - yTop - 52,
      width: 165,
      height: 52,
      color: toPdfColor(card.fill),
      borderColor: toPdfColor(card.stroke),
      borderWidth: 1,
    });
    page.drawText(card.label, {
      x: card.x + 14,
      y: topY(page.getHeight(), yTop + 10, 10),
      size: 10,
      font: helveticaBold,
      color: toPdfColor(card.color),
    });
    page.drawText(card.value, {
      x: card.x + 14,
      y: topY(page.getHeight(), yTop + 24, 18),
      size: 18,
      font: helveticaBold,
      color: toPdfColor(card.color),
    });
  }

  yTop += 78;

  page.drawText("Riepilogo mensile per merce", {
    x: MARGIN,
    y: topY(page.getHeight(), yTop, 14),
    size: 14,
    font: helveticaBold,
    color: toPdfColor("#0F172A"),
  });
  yTop += 22;

  drawMonthlySummaryHeader(page, { bold: helveticaBold }, yTop);
  yTop += 22;

  for (const row of monthlyReportRows) {
    const rowHeight = 18;
    if (yTop + rowHeight > PAGE_HEIGHT - MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      yTop = 40;
      page.drawText("Riepilogo mensile per merce", {
        x: MARGIN,
        y: topY(page.getHeight(), yTop, 14),
        size: 14,
        font: helveticaBold,
        color: toPdfColor("#0F172A"),
      });
      yTop += 22;
      drawMonthlySummaryHeader(page, { bold: helveticaBold }, yTop);
      yTop += 22;
    }

    const rowY = topY(page.getHeight(), yTop, 9);
    page.drawText(row.productName, { x: MARGIN, y: rowY, size: 9, font: helvetica, color: toPdfColor("#111827"), maxWidth: 175 });
    page.drawText(row.expectedSoldToDate?.toFixed(2) ?? "-", { x: 220, y: rowY, size: 9, font: helvetica, color: toPdfColor("#111827"), maxWidth: 130 });
    page.drawText(String(row.unloadedInMonth), { x: 370, y: rowY, size: 9, font: helvetica, color: toPdfColor("#111827"), maxWidth: 90 });
    drawMonthlyDeltaBadge(page, row.delta, 490, yTop, { regular: helvetica, bold: helveticaBold });

    page.drawLine({
      start: { x: MARGIN, y: page.getHeight() - yTop - rowHeight - 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: page.getHeight() - yTop - rowHeight - 4 },
      thickness: 1,
      color: toPdfColor("#E2E8F0"),
    });

    yTop += rowHeight + 10;
  }

  yTop += 6;
  drawTableHeader(page, { bold: helveticaBold }, yTop);
  yTop += 24;

  for (const movement of movements) {
    const note = movement.note?.trim() ? movement.note : "-";
    const rowHeight = Math.max(
      18,
      estimateWrappedHeight(movement.product.name, helveticaBold, 9, 145),
      estimateWrappedHeight(note, helvetica, 9, 105),
    );

    if (yTop + rowHeight > PAGE_HEIGHT - MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      yTop = 40;
      drawTableHeader(page, { bold: helveticaBold }, yTop);
      yTop += 24;
    }

    const rowY = topY(page.getHeight(), yTop, 9);
    page.drawText(dateFormatter.format(movement.createdAt), { x: 40, y: rowY, size: 9, font: helvetica, color: toPdfColor("#111827"), maxWidth: 72 });
    page.drawText(movement.product.name, { x: 120, y: rowY, size: 9, font: helvetica, color: toPdfColor("#111827"), maxWidth: 145, lineHeight: 11 });
    page.drawText(movementTypeLabels[movement.type], { x: 275, y: rowY, size: 9, font: helvetica, color: toPdfColor("#111827"), maxWidth: 60 });
    page.drawText(String(movement.quantity), { x: 330, y: rowY, size: 9, font: helvetica, color: toPdfColor("#111827"), maxWidth: 40 });
    page.drawText(unitLabels[movement.product.unit], { x: 380, y: rowY, size: 9, font: helvetica, color: toPdfColor("#111827"), maxWidth: 65 });
    page.drawText(note, { x: 450, y: rowY, size: 9, font: helvetica, color: toPdfColor("#111827"), maxWidth: 105, lineHeight: 11 });

    page.drawLine({
      start: { x: MARGIN, y: page.getHeight() - yTop - rowHeight - 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: page.getHeight() - yTop - rowHeight - 4 },
      thickness: 1,
      color: toPdfColor("#E2E8F0"),
    });

    yTop += rowHeight + 10;
  }

  const totalPages = pdf.getPageCount();
  pdf.getPages().forEach((pdfPage, index) => {
    drawPageFooter(pdfPage, { regular: helvetica }, index + 1, totalPages);
  });

  const buffer = await pdf.save();
  const timestamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="storico-magazzino-${timestamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
