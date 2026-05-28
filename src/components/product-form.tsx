"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { UnitOfMeasure } from "@prisma/client";

import { emitClientFeedback } from "@/lib/client-feedback";
import { unitLabels, unitOptions } from "@/lib/units";

type ProductFormValues = {
  id?: number;
  name?: string;
  description?: string | null;
  unit?: UnitOfMeasure;
  alertThreshold?: number | null;
};

type ProductFormProps = {
  lockUnit?: boolean;
  submitLabel?: string;
  values?: ProductFormValues;
};

export function ProductForm({
  lockUnit = false,
  submitLabel = "Salva merce",
  values,
}: ProductFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("action", values?.id ? "update" : "create");
    if (values?.id) {
      formData.set("productId", String(values.id));
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { kind?: string; message?: string };
      const kind = payload.kind === "success" ? "success" : "error";
      const message = payload.message ?? "Operazione completata.";

      if (kind === "success" && !values?.id) {
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
      {values?.id ? <input type="hidden" name="productId" value={values.id} /> : null}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-semibold text-slate-900">
          Nome merce
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="Es. Bancale mele"
          defaultValue={values?.name}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-semibold text-slate-900">
          Descrizione (facoltativa)
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          placeholder="Dettagli utili per identificare la merce (opzionale)"
          defaultValue={values?.description ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="unit" className="text-sm font-semibold text-slate-900">
          Unita di misura
        </label>
        {lockUnit && values?.unit ? <input type="hidden" name="unit" value={values.unit} /> : null}
        <select
          id="unit"
          name="unit"
          required
          disabled={lockUnit}
          defaultValue={values?.unit ?? UnitOfMeasure.CONFEZIONE}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {unitOptions.map((unit) => (
            <option key={unit} value={unit}>
              {unitLabels[unit]}
            </option>
          ))}
        </select>
        {lockUnit ? (
          <p className="text-xs leading-5 text-slate-500">
            Unita bloccata: esistono movimenti registrati per questa merce.
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label htmlFor="alertThreshold" className="text-sm font-semibold text-slate-900">
          Soglia alert (facoltativa)
        </label>
        <input
          id="alertThreshold"
          name="alertThreshold"
          type="number"
          min={1}
          step={1}
          placeholder="Es. 10"
          defaultValue={values?.alertThreshold ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
        <p className="text-xs leading-5 text-slate-500">
          Se impostata, quando la giacenza scende sotto questo valore la merce appare negli articoli in esaurimento.
        </p>
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong"
      >
        {isSubmitting ? "Salvataggio..." : submitLabel}
      </button>
    </form>
  );
}
