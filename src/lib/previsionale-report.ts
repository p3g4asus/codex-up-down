import { type Product, type UnitOfMeasure } from "@prisma/client";

export type MonthContext = {
  monthStart: Date;
  monthEnd: Date;
  referenceDate: Date;
  monthLabel: string;
};

export type ForecastRow = {
  productId: number;
  productName: string;
  unit: UnitOfMeasure;
  monthlyForecast: number | null;
  currentStockAtReference: number;
  expectedSoldToDate: number | null;
  unloadedToReference: number;
  deltaPercent: number | null;
  depletionDate: Date | null;
  stockNeededToMonthEnd: number | null;
  isCoverageSufficient: boolean | null;
};

export type ForecastFilterParams = {
  month?: string;
  productId?: string;
  coverage?: string;
  trend?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  dir?: string;
};

export const FORECAST_PAGE_SIZE = 12;
export const FORECAST_PAGE_SIZE_OPTIONS = [12, 24, 48] as const;

export type ForecastSortKey =
  | "product"
  | "monthlyForecast"
  | "currentStock"
  | "unloadedToReference"
  | "depletionDate"
  | "stockNeededToMonthEnd";

export type ForecastSortDir = "asc" | "desc";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0);
}

export function resolveMonthContext(monthFilter?: string, now: Date = new Date()): MonthContext {
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  const parsed = /^([0-9]{4})-([0-9]{2})$/.exec((monthFilter || "").trim());
  const year = parsed ? Number(parsed[1]) : currentYear;
  const monthNumber = parsed ? Number(parsed[2]) : currentMonthIndex + 1;
  const safeMonthIndex = monthNumber >= 1 && monthNumber <= 12 ? monthNumber - 1 : currentMonthIndex;

  const monthStart = new Date(year, safeMonthIndex, 1, 0, 0, 0, 0);
  const monthEndDate = lastDayOfMonth(year, safeMonthIndex);
  const monthEnd = new Date(year, safeMonthIndex, monthEndDate.getDate(), 23, 59, 59, 999);

  const isCurrentMonth = year === currentYear && safeMonthIndex === currentMonthIndex;
  const referenceDate = isCurrentMonth
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
    : monthEnd;

  return {
    monthStart,
    monthEnd,
    referenceDate,
    monthLabel: `${year}-${pad2(safeMonthIndex + 1)}`,
  };
}

function getDaysInMonth(context: MonthContext) {
  return context.monthEnd.getDate();
}

function getElapsedDays(context: MonthContext) {
  return context.referenceDate.getDate();
}

function getRemainingDaysIncludingToday(context: MonthContext) {
  // Se la data di riferimento coincide con la fine del mese (es. mese passato),
  // il mese e considerato completamente trascorso.
  if (context.referenceDate.getTime() >= context.monthEnd.getTime()) {
    return 0;
  }

  const daysInMonth = getDaysInMonth(context);
  const elapsed = getElapsedDays(context);
  return Math.max(0, daysInMonth - elapsed + 1);
}

export function buildForecastRows(
  products: Array<Pick<Product, "id" | "name" | "unit" | "stock" | "alertThreshold">>,
  unloadedToReferenceByProduct: Map<number, number>,
  loadsAfterReferenceByProduct: Map<number, number>,
  unloadsAfterReferenceByProduct: Map<number, number>,
  context: MonthContext,
): ForecastRow[] {
  const daysInMonth = getDaysInMonth(context);
  const elapsedDays = getElapsedDays(context);
  const remainingDays = getRemainingDaysIncludingToday(context);

  return products.map((product) => {
    const unloadedToReference = unloadedToReferenceByProduct.get(product.id) ?? 0;
    const loadsAfterReference = loadsAfterReferenceByProduct.get(product.id) ?? 0;
    const unloadsAfterReference = unloadsAfterReferenceByProduct.get(product.id) ?? 0;
    const currentStockAtReference = product.stock - loadsAfterReference + unloadsAfterReference;

    const monthlyForecast = product.alertThreshold;
    const expectedSoldToDate =
      monthlyForecast === null ? null : (monthlyForecast * elapsedDays) / daysInMonth;
    const deltaPercent =
      expectedSoldToDate === null || expectedSoldToDate <= 0
        ? null
        : (unloadedToReference / expectedSoldToDate) * 100 - 100;

    const dailyForecast = monthlyForecast === null ? null : monthlyForecast / daysInMonth;
    const depletionDate =
      dailyForecast === null || dailyForecast <= 0 || currentStockAtReference < 0
        ? null
        : (() => {
            if (currentStockAtReference === 0) {
              return new Date(context.referenceDate);
            }

            const daysCoverage = currentStockAtReference / dailyForecast;
            const offsetDays = Math.max(0, Math.ceil(daysCoverage) - 1);
            const estimated = new Date(context.referenceDate);
            estimated.setDate(estimated.getDate() + offsetDays);
            estimated.setHours(0, 0, 0, 0);
            return estimated;
          })();

    const stockNeededToMonthEnd =
      monthlyForecast === null ? null : (monthlyForecast * remainingDays) / daysInMonth;
    const isCoverageSufficient =
      stockNeededToMonthEnd === null ? null : currentStockAtReference >= stockNeededToMonthEnd;

    return {
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      monthlyForecast,
      currentStockAtReference,
      expectedSoldToDate,
      unloadedToReference,
      deltaPercent,
      depletionDate,
      stockNeededToMonthEnd,
      isCoverageSufficient,
    } satisfies ForecastRow;
  });
}

export function formatSignedPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

export function getMissingUnitsToCoverMonth(stockNeededToMonthEnd: number | null, currentStock: number) {
  if (stockNeededToMonthEnd === null) {
    return null;
  }

  return Math.max(0, Math.ceil(stockNeededToMonthEnd - currentStock));
}

export function buildForecastSearchParams(filters?: ForecastFilterParams) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export function getForecastPage(filters?: ForecastFilterParams) {
  const page = Number(filters?.page);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

export function getForecastPageSize(filters?: ForecastFilterParams) {
  const pageSize = Number(filters?.pageSize);

  if (FORECAST_PAGE_SIZE_OPTIONS.includes(pageSize as (typeof FORECAST_PAGE_SIZE_OPTIONS)[number])) {
    return pageSize;
  }

  return FORECAST_PAGE_SIZE;
}

export function getForecastSort(filters?: ForecastFilterParams): ForecastSortKey {
  const sort = filters?.sort;

  if (
    sort === "product" ||
    sort === "monthlyForecast" ||
    sort === "currentStock" ||
    sort === "unloadedToReference" ||
    sort === "depletionDate" ||
    sort === "stockNeededToMonthEnd"
  ) {
    return sort;
  }

  return "product";
}

export function getForecastSortDir(filters?: ForecastFilterParams): ForecastSortDir {
  return filters?.dir === "desc" ? "desc" : "asc";
}

function compareNullableNumber(a: number | null, b: number | null) {
  if (a === null && b === null) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  return a - b;
}

function compareNullableDate(a: Date | null, b: Date | null) {
  if (a === null && b === null) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  return a.getTime() - b.getTime();
}

export function sortForecastRows(rows: ForecastRow[], sort: ForecastSortKey, dir: ForecastSortDir) {
  const direction = dir === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    let comparison = 0;

    if (sort === "product") {
      comparison = left.productName.localeCompare(right.productName, "it");
    }

    if (sort === "monthlyForecast") {
      comparison = compareNullableNumber(left.monthlyForecast, right.monthlyForecast);
    }

    if (sort === "currentStock") {
      comparison = left.currentStockAtReference - right.currentStockAtReference;
    }

    if (sort === "unloadedToReference") {
      comparison = left.unloadedToReference - right.unloadedToReference;
    }

    if (sort === "depletionDate") {
      comparison = compareNullableDate(left.depletionDate, right.depletionDate);
    }

    if (sort === "stockNeededToMonthEnd") {
      comparison = compareNullableNumber(left.stockNeededToMonthEnd, right.stockNeededToMonthEnd);
    }

    if (comparison !== 0) {
      return comparison * direction;
    }

    return left.productName.localeCompare(right.productName, "it");
  });
}
