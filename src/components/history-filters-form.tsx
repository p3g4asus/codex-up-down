"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MovementType, Product } from "@prisma/client";

import { withBasePath } from "@/lib/base-path";
import { HISTORY_PAGE_SIZE_OPTIONS, type HistoryFilterParams } from "@/lib/history";

type HistoryFiltersFormProps = {
  filters?: HistoryFilterParams;
  pageSize: number;
  products: Product[];
  sort: string;
  dir: string;
};

function setParam(params: URLSearchParams, key: string, value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    params.delete(key);
    return;
  }

  params.set(key, String(value));
}

export function HistoryFiltersForm({ filters, pageSize, products, sort, dir }: HistoryFiltersFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const exportQuery = filters
    ? new URLSearchParams({
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        ...(filters.sort ? { sort: filters.sort } : {}),
        ...(filters.dir ? { dir: filters.dir } : {}),
      }).toString()
    : "";
  const csvHref = exportQuery
    ? `${withBasePath("/storico/export")}?${exportQuery}`
    : withBasePath("/storico/export");
  const pdfHref = exportQuery
    ? `${withBasePath("/storico/export/pdf")}?${exportQuery}`
    : withBasePath("/storico/export/pdf");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    setParam(params, "q", (formData.get("q") as string | null)?.trim() ?? "");
    setParam(params, "productId", formData.get("productId") as string | null);
    setParam(params, "type", formData.get("type") as string | null);
    setParam(params, "dateFrom", formData.get("dateFrom") as string | null);
    setParam(params, "dateTo", formData.get("dateTo") as string | null);
    setParam(params, "pageSize", formData.get("pageSize") as string | null);
    setParam(params, "sort", sort);
    setParam(params, "dir", dir);
    params.set("page", "1");

    setIsSubmitting(true);
    try {
      router.push(params.toString() ? `/storico?${params.toString()}` : "/storico");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      <div className="space-y-2">
        <label htmlFor="q" className="text-sm font-semibold text-slate-900">
          Cerca merce
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters?.q ?? ""}
          placeholder="Nome, descrizione o nota"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="productId" className="text-sm font-semibold text-slate-900">
          Merce
        </label>
        <select
          id="productId"
          name="productId"
          defaultValue={filters?.productId ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        >
          <option value="">Tutte le merci</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="type" className="text-sm font-semibold text-slate-900">
          Tipo movimento
        </label>
        <select
          id="type"
          name="type"
          defaultValue={filters?.type ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        >
          <option value="">Tutti i movimenti</option>
          <option value={MovementType.LOAD}>Carico</option>
          <option value={MovementType.UNLOAD}>Scarico</option>
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="dateFrom" className="text-sm font-semibold text-slate-900">
          Dal giorno
        </label>
        <input
          id="dateFrom"
          name="dateFrom"
          type="date"
          defaultValue={filters?.dateFrom ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="dateTo" className="text-sm font-semibold text-slate-900">
          Al giorno
        </label>
        <input
          id="dateTo"
          name="dateTo"
          type="date"
          defaultValue={filters?.dateTo ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
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
          {HISTORY_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 md:col-span-2 xl:col-span-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Applicazione..." : "Applica filtri"}
        </button>
        <a
          href={withBasePath("/storico")}
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
