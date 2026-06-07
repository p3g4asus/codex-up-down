"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { withBasePath } from "@/lib/base-path";
import {
  buildForecastSearchParams,
  FORECAST_PAGE_SIZE_OPTIONS,
  type ForecastFilterParams,
} from "@/lib/previsionale-report";

type ForecastProductOption = {
  id: number;
  name: string;
};

type ForecastFiltersFormProps = {
  filters?: ForecastFilterParams;
  products: ForecastProductOption[];
  monthOptions: Array<{ value: string; label: string }>;
  pageSize: number;
  sort: string;
  dir: string;
};

function setParam(params: URLSearchParams, key: string, value?: string | null) {
  if (!value || !value.trim()) {
    params.delete(key);
    return;
  }

  params.set(key, value.trim());
}

export function ForecastFiltersForm({ filters, products, monthOptions, pageSize, sort, dir }: ForecastFiltersFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryString = buildForecastSearchParams({
    month: filters?.month,
    productId: filters?.productId,
    coverage: filters?.coverage,
    trend: filters?.trend,
    pageSize: String(pageSize),
    sort,
    dir,
  });
  const csvHref = queryString
    ? `${withBasePath("/report/previsionale/export")}?${queryString}`
    : withBasePath("/report/previsionale/export");
  const pdfHref = queryString
    ? `${withBasePath("/report/previsionale/export/pdf")}?${queryString}`
    : withBasePath("/report/previsionale/export/pdf");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    setParam(params, "month", formData.get("month") as string | null);
    setParam(params, "productId", formData.get("productId") as string | null);
    setParam(params, "coverage", formData.get("coverage") as string | null);
    setParam(params, "trend", formData.get("trend") as string | null);
    setParam(params, "pageSize", formData.get("pageSize") as string | null);
    setParam(params, "sort", sort);
    setParam(params, "dir", dir);
    params.set("page", "1");

    setIsSubmitting(true);
    try {
      router.push(params.toString() ? `/report/previsionale?${params.toString()}` : "/report/previsionale");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <div className="space-y-2">
        <label htmlFor="month" className="text-sm font-semibold text-slate-900">
          Mese
        </label>
        <select
          id="month"
          name="month"
          defaultValue={filters?.month ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        >
          <option value="">Mese corrente</option>
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="productId" className="text-sm font-semibold text-slate-900">
          Articolo
        </label>
        <select
          id="productId"
          name="productId"
          defaultValue={filters?.productId ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        >
          <option value="">Tutti gli articoli</option>
          {products.map((product) => (
            <option key={product.id} value={String(product.id)}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="coverage" className="text-sm font-semibold text-slate-900">
          Copertura stock
        </label>
        <select
          id="coverage"
          name="coverage"
          defaultValue={filters?.coverage ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        >
          <option value="">Tutte</option>
          <option value="covered">Copertura sufficiente</option>
          <option value="uncovered">Copertura insufficiente</option>
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="trend" className="text-sm font-semibold text-slate-900">
          Trend vendite
        </label>
        <select
          id="trend"
          name="trend"
          defaultValue={filters?.trend ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        >
          <option value="">Tutti</option>
          <option value="above">Piu vendite del previsto</option>
          <option value="not-above">Non piu vendite del previsto</option>
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="pageSize" className="text-sm font-semibold text-slate-900">
          Righe per pagina
        </label>
        <select
          id="pageSize"
          name="pageSize"
          defaultValue={String(pageSize)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        >
          {FORECAST_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-5">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Applicazione..." : "Applica filtri"}
        </button>
        <a
          href={withBasePath("/report/previsionale")}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          Azzera
        </a>
        <a
          href={csvHref}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          Esporta CSV
        </a>
        <a
          href={pdfHref}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          Esporta PDF
        </a>
      </div>
    </form>
  );
}
