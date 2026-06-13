import { MovementType } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

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

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const BOTTOM_MARGIN = 62;
const columns = [
  { label: "Codice articolo", x: MARGIN, w: 70 },
  { label: "Nome articolo", x: 112, w: 130 },
  { label: "Vendita mensile prevista", x: 245, w: 70 },
  { label: "Contenitore", x: 320, w: 85 },
  { label: "Data ultimo carico", x: 410, w: 80 },
  { label: "Giacenza attuale", x: 495, w: 80 },
];

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
});

function toPdfColor(hex: string) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  return rgb(red, green, blue);
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

function drawPageHeader(options: {
  page: PDFPage;
  bold: PDFFont;
  regular: PDFFont;
  referenceDateText: string;
  pageIndex: number;
}) {
  const { page, bold, regular, referenceDateText, pageIndex } = options;

  const title = pageIndex === 1 ? "Report articoli" : `Report articoli - Pagina ${pageIndex}`;

  page.drawText(title, {
    x: MARGIN,
    y: PAGE_HEIGHT - 42,
    size: 18,
    font: bold,
    color: toPdfColor("#0F172A"),
  });

  page.drawText(`Data di riferimento: ${referenceDateText}`, {
    x: MARGIN,
    y: PAGE_HEIGHT - 58,
    size: 10,
    font: regular,
    color: toPdfColor("#475569"),
  });

  const headerFontSize = 9;
  const headerLineHeight = 10;
  const headerTop = PAGE_HEIGHT - 86;
  const wrappedHeaders = columns.map((column) => ({
    ...column,
    lines: wrapTextByWidth(column.label, column.w, (value) => bold.widthOfTextAtSize(value, headerFontSize)),
  }));
  const headerHeight = Math.max(...wrappedHeaders.map((column) => column.lines.length)) * headerLineHeight;

  for (const column of wrappedHeaders) {
    column.lines.forEach((line, index) => {
      page.drawText(line, {
        x: column.x,
        y: headerTop - index * headerLineHeight,
        size: headerFontSize,
        font: bold,
        color: toPdfColor("#334155"),
      });
    });
  }

  const y = headerTop - headerHeight - 4;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: toPdfColor("#CBD5E1"),
  });

  return y - 14;
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

  const pdf = await PDFDocument.create();
  pdf.setTitle("Report articoli");
  pdf.setAuthor("codex-up-down");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let pageIndex = 1;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawPageHeader({
    page,
    bold,
    regular,
    referenceDateText: dateFormatter.format(referenceDate),
    pageIndex,
  });

  const textSize = 9;
  const lineHeight = 12;
  const verticalPadding = 4;
  const rowGap = 8;

  for (const row of reportRows) {
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
        text: row.monthlyForecast ? String(row.monthlyForecast) : "-",
        font: regular,
        color: toPdfColor("#111827"),
      },
      {
        x: columns[3].x,
        width: columns[3].w,
        text: containerLabels[row.container],
        font: regular,
        color: toPdfColor("#111827"),
      },
      {
        x: columns[4].x,
        width: columns[4].w,
        text: row.lastLoadAt ? dateFormatter.format(row.lastLoadAt) : "Nessun carico",
        font: regular,
        color: toPdfColor("#111827"),
      },
      {
        x: columns[5].x,
        width: columns[5].w,
        text: String(row.currentStock),
        font: regular,
        color: toPdfColor("#111827"),
      },
    ];

    const cellsWithLines = rowCells.map((cell) => {
      const lines = wrapTextByWidth(cell.text, cell.width, (value) => cell.font.widthOfTextAtSize(value, textSize));
      return { ...cell, lines };
    });

    const maxLines = Math.max(...cellsWithLines.map((cell) => cell.lines.length));
    const rowHeight = maxLines * lineHeight + verticalPadding;
    const consumedHeight = rowHeight + rowGap;

    if (y - consumedHeight < BOTTOM_MARGIN) {
      pageIndex += 1;
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawPageHeader({
        page,
        bold,
        regular,
        referenceDateText: dateFormatter.format(referenceDate),
        pageIndex,
      });
    }

    for (const cell of cellsWithLines) {
      cell.lines.forEach((line, index) => {
        page.drawText(line, {
          x: cell.x,
          y: y - index * lineHeight,
          size: textSize,
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
      "Content-Disposition": `attachment; filename="report-articoli-${timestamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
