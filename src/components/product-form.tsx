"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { UnitOfMeasure, type ContainerType } from "@prisma/client";

import { withBasePath } from "@/lib/base-path";
import { emitClientFeedback } from "@/lib/client-feedback";
import { containerLabels, containerOptions } from "@/lib/containers";
import { unitLabels, unitOptions } from "@/lib/units";

type ProductFormValues = {
  id?: number;
  name?: string;
  code?: string;
  plu?: number;
  description?: string | null;
  unit?: UnitOfMeasure;
  container?: ContainerType;
  alertThreshold?: number | null;
};

type ProductFormProps = {
  lockUnit?: boolean;
  submitLabel?: string;
  values?: ProductFormValues;
};

export function ProductForm({
  lockUnit = false,
  submitLabel = "Salva articolo",
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
      const response = await fetch(withBasePath("/api/products"), {
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
          Nome articolo
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
          placeholder="Dettagli utili per identificare l'articolo (opzionale)"
          defaultValue={values?.description ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="code" className="text-sm font-semibold text-slate-900">
            Codice articolo
          </label>
          <input
            id="code"
            name="code"
            required
            inputMode="numeric"
            pattern="[0-9]+"
            title="Usa solo numeri"
            placeholder="Es. 123456"
            defaultValue={values?.code ?? ""}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="plu" className="text-sm font-semibold text-slate-900">
            PLU numerico
          </label>
          <input
            id="plu"
            name="plu"
            type="number"
            min={1}
            step={1}
            required
            placeholder="Es. 123456"
            defaultValue={values?.plu ?? ""}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="container" className="text-sm font-semibold text-slate-900">
          Contenitore
        </label>
        <select
          id="container"
          name="container"
          required
          defaultValue={values?.container ?? "CASSETTA_BIANCA"}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        >
          {containerOptions.map((container) => (
            <option key={container} value={container}>
              {containerLabels[container]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="unit" className="text-sm font-semibold text-slate-900">
          Unità di misura
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
            Unità bloccata: esistono movimenti registrati per questo articolo.
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label htmlFor="alertThreshold" className="text-sm font-semibold text-slate-900">
          Venduto previsto mensile (facoltativo)
        </label>
        <input
          id="alertThreshold"
          name="alertThreshold"
          type="number"
          min={1}
          step={1}
          placeholder="Es. 120"
          defaultValue={values?.alertThreshold ?? ""}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
        />
        <p className="text-xs leading-5 text-slate-500">
          Se impostato, l&apos;alert scatta quando la giacenza è inferiore al venduto previsto per il resto del mese,
          assumendo una vendita uniforme giorno per giorno.
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
