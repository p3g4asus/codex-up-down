"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { withBasePath } from "@/lib/base-path";
import {
  ARTICLES_PAGE_SIZE_OPTIONS,
  buildArticlesSearchParams,
  type ArticlesFilterParams,
} from "@/lib/articoli-report";

type ArticleOption = {
  id: number;
  name: string;
};

type ArticlesFiltersFormProps = {
  filters?: ArticlesFilterParams;
  products: ArticleOption[];
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

export function ArticlesFiltersForm({ filters, products, pageSize, sort, dir }: ArticlesFiltersFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedDateLabel = filters?.date
    ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
        new Date(`${filters.date}T00:00:00`),
      )
    : null;

  const exportQuery = buildArticlesSearchParams({
    productId: filters?.productId,
    date: filters?.date,
    sort,
    dir,
  });

  const csvHref = exportQuery
    ? `${withBasePath("/report/articoli/export")}?${exportQuery}`
    : withBasePath("/report/articoli/export");
  const pdfHref = exportQuery
    ? `${withBasePath("/report/articoli/export/pdf")}?${exportQuery}`
    : withBasePath("/report/articoli/export/pdf");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    setParam(params, "productId", formData.get("productId") as string | null);
    setParam(params, "date", formData.get("date") as string | null);
    setParam(params, "pageSize", formData.get("pageSize") as string | null);
    setParam(params, "sort", sort);
    setParam(params, "dir", dir);
    params.set("page", "1");

    setIsSubmitting(true);
    try {
      router.push(params.toString() ? `/report/articoli?${params.toString()}` : "/report/articoli");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        <label htmlFor="date" className="text-sm font-semibold text-slate-900">
          Data riferimento
        </label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={filters?.date ?? ""}
          lang="it-IT"
          title="Formato data: gg/mm/aaaa"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
        <p className="text-xs text-slate-500">Formato: gg/mm/aaaa{selectedDateLabel ? ` - Selezionata: ${selectedDateLabel}` : ""}</p>
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
          {ARTICLES_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Applicazione..." : "Applica filtri"}
        </button>
        <a
          href={withBasePath("/report/articoli")}
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
