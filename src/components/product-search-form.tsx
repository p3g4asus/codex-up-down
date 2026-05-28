"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ProductSearchFormProps = {
  query?: string;
  sort: string;
  dir: string;
};

export function ProductSearchForm({ query, sort, dir }: ProductSearchFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const search = (formData.get("q") as string | null)?.trim() ?? "";

    if (search) {
      params.set("q", search);
    }
    if (sort !== "name") {
      params.set("sort", sort);
    }
    if (dir !== "asc") {
      params.set("dir", dir);
    }

    setIsSubmitting(true);
    try {
      router.push(params.toString() ? `/merci?${params.toString()}` : "/merci");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
      <div className="w-full max-w-xl space-y-2">
        <label htmlFor="q" className="text-sm font-semibold text-slate-900">
          Cerca per nome o descrizione
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query ?? ""}
          placeholder="Es. bancale mele o pallet frutta"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
      </div>
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="dir" value={dir} />
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Ricerca..." : "Cerca"}
        </button>
        <a
          href="/merci"
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          Azzera
        </a>
      </div>
    </form>
  );
}
