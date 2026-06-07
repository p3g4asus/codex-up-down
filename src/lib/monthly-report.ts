import type { UnitOfMeasure } from "@prisma/client";

export type MonthlyReportProduct = {
  id: number;
  name: string;
  unit: UnitOfMeasure;
  alertThreshold: number | null;
};

export type MonthlyReportRow = {
  productId: number;
  productName: string;
  unit: UnitOfMeasure;
  expectedSoldToDate: number | null;
  unloadedInMonth: number;
  delta: number | null;
};

export function getCurrentMonthRange(referenceDate: Date = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

function getDaysInMonth(referenceDate: Date) {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
}

export function getExpectedMonthlySalesToDate(monthlyForecast: number, referenceDate: Date = new Date()) {
  const dayOfMonth = referenceDate.getDate();
  const daysInMonth = getDaysInMonth(referenceDate);

  return (monthlyForecast * dayOfMonth) / daysInMonth;
}

export function formatMonthlyDelta(value: number | null) {
  if (value === null) {
    return "-";
  }

  const rounded = Math.round(value * 100) / 100;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

export function buildMonthlyReportRows(
  products: MonthlyReportProduct[],
  unloadedTotalsByProduct: Map<number, number>,
  referenceDate: Date = new Date(),
) {
  return products
    .map((product) => {
      const unloadedInMonth = unloadedTotalsByProduct.get(product.id) ?? 0;
      const expectedSoldToDate =
        product.alertThreshold === null
          ? null
          : getExpectedMonthlySalesToDate(product.alertThreshold, referenceDate);
      const delta = expectedSoldToDate === null ? null : unloadedInMonth - expectedSoldToDate;

      return {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        expectedSoldToDate,
        unloadedInMonth,
        delta,
      } satisfies MonthlyReportRow;
    })
    .filter((row) => row.expectedSoldToDate !== null || row.unloadedInMonth > 0);
}
