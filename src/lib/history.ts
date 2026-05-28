import { MovementType, Prisma } from "@prisma/client";

export type HistoryFilterParams = {
  q?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  dir?: string;
  productId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  kind?: string;
  message?: string;
};

export const HISTORY_PAGE_SIZE = 12;
export const HISTORY_PAGE_SIZE_OPTIONS = [12, 24, 48] as const;

export const movementTypeLabels = {
  [MovementType.LOAD]: "Carico",
  [MovementType.UNLOAD]: "Scarico",
} as const;

function isMovementType(value?: string): value is MovementType {
  return value === MovementType.LOAD || value === MovementType.UNLOAD;
}

function startOfDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  date.setHours(23, 59, 59, 999);
  return date;
}

export function buildHistoryWhere(filters?: HistoryFilterParams): Prisma.MovementWhereInput {
  const query = filters?.q?.trim();
  const productId = filters?.productId ? Number(filters.productId) : undefined;
  const movementType = isMovementType(filters?.type) ? filters.type : undefined;
  const dateFrom = filters?.dateFrom ? startOfDay(filters.dateFrom) : undefined;
  const dateTo = filters?.dateTo ? endOfDay(filters.dateTo) : undefined;

  return {
    ...(query
      ? {
          OR: [
            {
              product: {
                name: {
                  contains: query,
                },
              },
            },
            {
              product: {
                description: {
                  contains: query,
                },
              },
            },
            {
              note: {
                contains: query,
              },
            },
          ],
        }
      : {}),
    ...(productId && Number.isInteger(productId) ? { productId } : {}),
    ...(movementType ? { type: movementType } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
  };
}

export function buildHistorySearchParams(filters?: HistoryFilterParams) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export function getHistoryPage(filters?: HistoryFilterParams) {
  const page = Number(filters?.page);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

export function getHistoryPageSize(filters?: HistoryFilterParams) {
  const pageSize = Number(filters?.pageSize);

  if (HISTORY_PAGE_SIZE_OPTIONS.includes(pageSize as (typeof HISTORY_PAGE_SIZE_OPTIONS)[number])) {
    return pageSize;
  }

  return HISTORY_PAGE_SIZE;
}

export function getHistorySort(filters?: HistoryFilterParams) {
  const sort = filters?.sort;
  if (sort === "product" || sort === "type" || sort === "quantity") {
    return sort;
  }

  return "createdAt";
}

export function getHistorySortDir(filters?: HistoryFilterParams) {
  return filters?.dir === "asc" ? "asc" : "desc";
}

export function getHistoryOrderBy(filters?: HistoryFilterParams): Prisma.MovementOrderByWithRelationInput[] {
  const sort = getHistorySort(filters);
  const dir = getHistorySortDir(filters);

  if (sort === "product") {
    return [{ product: { name: dir } }, { createdAt: "desc" }];
  }

  if (sort === "type") {
    return [{ type: dir }, { createdAt: "desc" }];
  }

  if (sort === "quantity") {
    return [{ quantity: dir }, { createdAt: "desc" }];
  }

  return [{ createdAt: dir }];
}
