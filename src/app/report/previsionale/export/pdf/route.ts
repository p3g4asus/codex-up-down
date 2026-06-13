import { MovementType } from "@prisma/client";
import { PDFFont, PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";

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

export const runtime = "nodejs";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
const BOTTOM_MARGIN = 45;
const columns = [
  { label: "Codice", x: MARGIN, w: 60 },
  { label: "Articolo", x: 92, w: 118 },
  { label: "Previsto mese", x: 214, w: 56 },
  { label: "Giacenza", x: 274, w: 52 },
  { label: "Stock copertura", x: 330, w: 84 },
  { label: "Vendita eff.", x: 418, w: 72 },
  { label: "Esaurimento", x: 494, w: 82 },
  { label: "Stock mese", x: 580, w: 86 },
  { label: "Esito", x: 670, w: 138 },
];

function toPdfColor(hex: string) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  return rgb(red, green, blue);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function drawPageHeader(options: {
  page: PDFPage;
  bold: PDFFont;
  regular: PDFFont;
  monthLabel: string;
  referenceDateText: string;
  pageIndex: number;
}) {
  const { page, bold, regular, monthLabel, referenceDateText, pageIndex } = options;

  const title = pageIndex === 1 ? "Report previsionale" : `Report previsionale - Pagina ${pageIndex}`;

  page.drawText(title, {
    x: MARGIN,
    y: PAGE_HEIGHT - 34,
    size: 18,
    font: bold,
    color: toPdfColor("#0F172A"),
  });

  page.drawText(`Mese: ${monthLabel}   Data di riferimento: ${referenceDateText}`, {
    x: MARGIN,
    y: PAGE_HEIGHT - 52,
    size: 10,
    font: regular,
    color: toPdfColor("#475569"),
  });

  let y = PAGE_HEIGHT - 76;

  for (const column of columns) {
    page.drawText(column.label, {
      x: column.x,
      y,
      size: 9,
      font: bold,
      color: toPdfColor("#334155"),
    });
  }

  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: toPdfColor("#CBD5E1"),
  });

  return y - 14;
}

function wrapTextByWidth(text: string, maxWidth: number, measureText: (value: string) => number) {
  const normalized = text.trim();
  if (!normalized) {
    return [""];
  }

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (measureText(nextLine) <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }

    if (measureText(word) <= maxWidth) {
      currentLine = word;
      continue;
    }

    let chunk = "";
    for (const char of word) {
      const nextChunk = `${chunk}${char}`;
      if (measureText(nextChunk) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = nextChunk;
      }
    }

    if (chunk) {
      currentLine = chunk;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
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

  const dateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "short" });

  const pdf = await PDFDocument.create();
  pdf.setTitle("Report previsionale");
  pdf.setAuthor("codex-up-down");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let pageIndex = 1;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawPageHeader({
    page,
    bold,
    regular,
    monthLabel: monthContext.monthLabel,
    referenceDateText: dateFormatter.format(monthContext.referenceDate),
    pageIndex,
  });

  for (const row of reportRows) {

    const depletionTone =
      row.depletionDate === null
        ? toPdfColor("#475569")
        : row.depletionDate > monthContext.monthEnd
          ? toPdfColor("#166534")
          : isSameDay(row.depletionDate, monthContext.monthEnd)
            ? toPdfColor("#111827")
            : toPdfColor("#B91C1C");

    const coverageTone =
      row.isCoverageSufficient === null
        ? toPdfColor("#475569")
        : row.isCoverageSufficient
          ? toPdfColor("#166534")
          : toPdfColor("#B91C1C");

    const deltaTone =
      row.deltaPercent === null
        ? toPdfColor("#475569")
        : row.deltaPercent > 0
          ? toPdfColor("#166534")
          : row.deltaPercent < 0
            ? toPdfColor("#B91C1C")
            : toPdfColor("#111827");

    const missingUnits = getMissingUnitsToCoverMonth(row.stockNeededToMonthEnd, row.currentStockAtReference);
    const stockNeededForMonthlySales = row.stockNeededForMonthlySales;
    const stockNeededForMonthlySalesTone =
      stockNeededForMonthlySales === null
        ? toPdfColor("#475569")
        : stockNeededForMonthlySales < 0
          ? toPdfColor("#B45309")
          : stockNeededForMonthlySales <= row.currentStockAtReference
            ? toPdfColor("#166534")
            : toPdfColor("#B91C1C");
    const rowCells = [
      {
        x: columns[0].x,
        width: columns[0].w,
        text: row.productCode,
        font: regular,
        color: toPdfColor("#111827"),
      },
      {
        x: columns[1].x,
        width: columns[1].w,
        text: row.productName,
        font: regular,
        color: toPdfColor("#111827"),
      },
      {
        x: columns[2].x,
        width: columns[2].w,
        text: String(row.monthlyForecast !== null ? Math.round(row.monthlyForecast) : "-"),
        font: regular,
        color: toPdfColor("#111827"),
      },
      {
        x: columns[3].x,
        width: columns[3].w,
        text: String(row.currentStockAtReference),
        font: regular,
        color: toPdfColor("#111827"),
      },
      {
        x: columns[4].x,
        width: columns[4].w,
        text:
          stockNeededForMonthlySales === null
            ? "Dati insuff."
            : stockNeededForMonthlySales < 0
              ? "Vendita superiore al previsto"
              : String(Math.round(stockNeededForMonthlySales)),
        font: bold,
        color: stockNeededForMonthlySalesTone,
      },
      {
        x: columns[5].x,
        width: columns[5].w,
        text: `${Math.round(row.unloadedToReference)} (${formatSignedPercent(row.deltaPercent)})`,
        font: bold,
        color: deltaTone,
      },
      {
        x: columns[6].x,
        width: columns[6].w,
        text: row.depletionDate ? dateFormatter.format(row.depletionDate) : "Dati insuff.",
        font: bold,
        color: depletionTone,
      },
      {
        x: columns[7].x,
        width: columns[7].w,
        text:
          row.stockNeededToMonthEnd !== null
            ? `${Math.round(row.stockNeededToMonthEnd)}${
                row.isCoverageSufficient === false && missingUnits !== null ? ` (Mancano ${missingUnits})` : ""
              }`
            : "Dati insuff.",
        font: bold,
        color: coverageTone,
      },
      {
        x: columns[8].x,
        width: columns[8].w,
        text:
          row.isCoverageSufficient === null
            ? "Dati non sufficienti"
            : row.isCoverageSufficient
              ? "Copertura sufficiente"
              : "Copertura insufficiente",
        font: bold,
        color: coverageTone,
      },
    ];

    const textSize = 8;
    const verticalPadding = 4;
    const rowGap = 8;
    const verboseColumns = new Set([4, 7, 8]);

    const getLineHeight = (size: number) => size + 3;

    const cellsWithLines = rowCells.map((cell, index) => {
      const cellTextSize = verboseColumns.has(index) ? 7 : textSize;
      const lines = wrapTextByWidth(cell.text, cell.width, (value) => cell.font.widthOfTextAtSize(value, cellTextSize));
      return { ...cell, lines, textSize: cellTextSize, lineHeight: getLineHeight(cellTextSize) };
    });

    const rowContentHeight = Math.max(...cellsWithLines.map((cell) => cell.lines.length * cell.lineHeight));
    const rowHeight = rowContentHeight + verticalPadding;
    const consumedHeight = rowHeight + rowGap;

    if (y - consumedHeight < BOTTOM_MARGIN) {
      pageIndex += 1;
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawPageHeader({
        page,
        bold,
        regular,
        monthLabel: monthContext.monthLabel,
        referenceDateText: dateFormatter.format(monthContext.referenceDate),
        pageIndex,
      });
    }

    for (const cell of cellsWithLines) {
      cell.lines.forEach((line, index) => {
        page.drawText(line, {
          x: cell.x,
          y: y - index * cell.lineHeight,
          size: cell.textSize,
          font: cell.font,
          color: cell.color,
        });
      });
    }

    const rowBottom = y - rowHeight;
    page.drawLine({
      start: { x: MARGIN, y: rowBottom },
      end: { x: PAGE_WIDTH - MARGIN, y: rowBottom },
      thickness: 1,
      color: toPdfColor("#E2E8F0"),
    });

    y = rowBottom - rowGap;
  }

  const pages = pdf.getPages();
  const totalPages = pages.length;
  for (let index = 0; index < totalPages; index += 1) {
    const footerPage = pages[index];
    const footerText = `Pagina ${index + 1}/${totalPages}`;
    const footerSize = 9;
    const footerWidth = regular.widthOfTextAtSize(footerText, footerSize);

    footerPage.drawLine({
      start: { x: MARGIN, y: 30 },
      end: { x: PAGE_WIDTH - MARGIN, y: 30 },
      thickness: 1,
      color: toPdfColor("#CBD5E1"),
    });

    footerPage.drawText(footerText, {
      x: (PAGE_WIDTH - footerWidth) / 2,
      y: 16,
      size: footerSize,
      font: regular,
      color: toPdfColor("#64748B"),
    });
  }

  const buffer = await pdf.save();
  const timestamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-previsionale-${timestamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
