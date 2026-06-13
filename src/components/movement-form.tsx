"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Product } from "@prisma/client";

import { withBasePath } from "@/lib/base-path";
import { emitClientFeedback } from "@/lib/client-feedback";
import { unitLabels } from "@/lib/units";

type MovementFormProps = {
  mode: "load" | "unload";
  products: Product[];
};

export function MovementForm({ mode, products }: MovementFormProps) {
  const isLoad = mode === "load";
  const submitLabel = isLoad ? "Conferma carico" : "Conferma scarico";
  const helperText = isLoad
    ? "Aumenta la giacenza di un articolo già censito."
    : "Riduce la giacenza solo se la disponibilità è sufficiente.";
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("action", isLoad ? "load" : "unload");

    setIsSubmitting(true);

    try {
      const response = await fetch(withBasePath("/api/movements"), {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { kind?: string; message?: string };
      const kind = payload.kind === "success" ? "success" : "error";
      const message = payload.message ?? "Operazione completata.";

      if (kind === "success") {
        form.reset();
      }

      emitClientFeedback({ kind, message });
      if (kind === "success") {
        router.refresh();
      }
    } catch {
      emitClientFeedback({ kind: "error", message: "Impossibile contattare il server." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-950">
          {isLoad ? "Registra un carico" : "Registra uno scarico"}
        </h2>
        <p className="text-sm leading-6 text-slate-600">{helperText}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="productId" className="text-sm font-semibold text-slate-900">
          Articolo
        </label>
        <select
          id="productId"
          name="productId"
          required
          disabled={products.length === 0}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:bg-slate-100"
          defaultValue=""
        >
          <option value="" disabled>
            {products.length === 0 ? "Nessun articolo disponibile" : "Seleziona un articolo"}
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} - giacenza {product.stock} {unitLabels[product.unit]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="quantity" className="text-sm font-semibold text-slate-900">
          Quantità (in unità dell&apos;articolo)
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          required
          min={1}
          step={1}
          placeholder="0"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="note" className="text-sm font-semibold text-slate-900">
          Nota operazione
        </label>
        <textarea
          id="note"
          name="note"
          rows={4}
          placeholder={isLoad ? "Es. arrivo da fornitore" : "Es. spedizione ordine cliente"}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={products.length === 0 || isSubmitting}
        className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSubmitting ? "Invio..." : submitLabel}
      </button>
    </form>
  );
}
