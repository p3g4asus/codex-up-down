import { type ContainerType, type Product } from "@prisma/client";

import { containerLabels } from "@/lib/containers";

export type ArticlesFilterParams = {
  q?: string;
  productId?: string;
  date?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  dir?: string;
};

export type ArticleReportRow = {
  productId: number;
  productCode: string;
  productName: string;
  monthlyForecast: number | null;
  container: ContainerType;
  currentStock: number;
  lastLoadAt: Date | null;
};

export type ArticlesSortKey = "product" | "code" | "alertThreshold" | "container" | "lastLoadAt";
export type ArticlesSortDir = "asc" | "desc";

export const ARTICLES_PAGE_SIZE = 12;
export const ARTICLES_PAGE_SIZE_OPTIONS = [12, 24, 48] as const;

function normalizeQuery(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseDateFilter(dateFilter?: string) {
  const normalized = (dateFilter || "").trim();
  const parsed = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(normalized);
  if (!parsed) {
    return null;
  }

  const year = Number(parsed[1]);
  const month = Number(parsed[2]);
  const day = Number(parsed[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function resolveArticlesReferenceDate(dateFilter?: string, now: Date = new Date()) {
  const parsed = parseDateFilter(dateFilter);
  if (parsed) {
    return parsed;
  }

  return endOfDay(now);
}

export function buildArticlesWhere(filters?: ArticlesFilterParams) {
  const query = normalizeQuery(filters?.q);

  return {
    ...(query
      ? {
          OR: [
            {
              name: {
                contains: query,
              },
            },
            {
              description: {
                contains: query,
              },
            },
          ],
        }
      : {}),
  };
}

export function buildArticlesRows(
  products: Array<Pick<Product, "id" | "code" | "name" | "stock" | "alertThreshold" | "container">>,
  lastLoadAtByProduct: Map<number, Date | null>,
): ArticleReportRow[] {
  return products.map((product) => {
    return {
      productId: product.id,
      productCode: product.code ?? "",
      productName: product.name,
      monthlyForecast: product.alertThreshold ?? null,
      container: product.container,
      currentStock: product.stock,
      lastLoadAt: lastLoadAtByProduct.get(product.id) ?? null,
    } satisfies ArticleReportRow;
  });
}

export function buildArticlesSearchParams(filters?: ArticlesFilterParams) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export function getArticlesPage(filters?: ArticlesFilterParams) {
  const page = Number(filters?.page);
  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

export function getArticlesPageSize(filters?: ArticlesFilterParams) {
  const pageSize = Number(filters?.pageSize);
  if (ARTICLES_PAGE_SIZE_OPTIONS.includes(pageSize as (typeof ARTICLES_PAGE_SIZE_OPTIONS)[number])) {
    return pageSize;
  }

  return ARTICLES_PAGE_SIZE;
}

export function getArticlesSort(filters?: ArticlesFilterParams): ArticlesSortKey {
  const sort = filters?.sort;
  if (
    sort === "product" ||
    sort === "code" ||
    sort === "alertThreshold" ||
    sort === "container" ||
    sort === "lastLoadAt"
  ) {
    return sort;
  }

  return "product";
}

export function getArticlesSortDir(filters?: ArticlesFilterParams): ArticlesSortDir {
  return filters?.dir === "desc" ? "desc" : "asc";
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

export function sortArticlesRows(rows: ArticleReportRow[], sort: ArticlesSortKey, dir: ArticlesSortDir) {
  const direction = dir === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    let comparison = 0;

    if (sort === "product") {
      comparison = left.productName.localeCompare(right.productName, "it");
    }

    if (sort === "code") {
      comparison = Number(left.productCode) - Number(right.productCode);
    }

    if (sort === "alertThreshold") {
      comparison = compareNullableNumber(left.monthlyForecast, right.monthlyForecast);
    }

    if (sort === "container") {
      comparison = containerLabels[left.container].localeCompare(containerLabels[right.container], "it");
    }

    if (sort === "lastLoadAt") {
      comparison = compareNullableDate(left.lastLoadAt, right.lastLoadAt);
    }

    if (comparison !== 0) {
      return comparison * direction;
    }

    return left.productName.localeCompare(right.productName, "it");
  });
}
