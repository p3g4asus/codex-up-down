import { UnitOfMeasure } from "@prisma/client";

import { createProduct } from "@/app/actions";
import { unitLabels, unitOptions } from "@/lib/units";

type ProductFormValues = {
  id?: number;
  name?: string;
  description?: string | null;
  unit?: UnitOfMeasure;
  alertThreshold?: number | null;
};

type ProductFormProps = {
  action?: (formData: FormData) => void | Promise<void>;
  returnTo?: string;
  lockUnit?: boolean;
  submitLabel?: string;
  values?: ProductFormValues;
};

export function ProductForm({
  action = createProduct,
  returnTo,
  lockUnit = false,
  submitLabel = "Salva merce",
  values,
}: ProductFormProps) {
  return (
    <form action={action} className="space-y-5 rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
      {values?.id ? <input type="hidden" name="productId" value={values.id} /> : null}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
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
        className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong"
      >
        {submitLabel}
      </button>
    </form>
  );
}
