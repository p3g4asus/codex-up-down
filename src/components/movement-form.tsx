import { Product } from "@prisma/client";

import { registerLoad, registerUnload } from "@/app/actions";
import { unitLabels } from "@/lib/units";

type MovementFormProps = {
  mode: "load" | "unload";
  products: Product[];
};

export function MovementForm({ mode, products }: MovementFormProps) {
  const isLoad = mode === "load";
  const action = isLoad ? registerLoad : registerUnload;
  const submitLabel = isLoad ? "Conferma carico" : "Conferma scarico";
  const helperText = isLoad
    ? "Aumenta la giacenza di una merce gia censita."
    : "Riduce la giacenza solo se la disponibilita e sufficiente.";

  return (
    <form action={action} className="space-y-5 rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-panel backdrop-blur">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-950">
          {isLoad ? "Registra un carico" : "Registra uno scarico"}
        </h2>
        <p className="text-sm leading-6 text-slate-600">{helperText}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="productId" className="text-sm font-semibold text-slate-900">
          Merce
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
            {products.length === 0 ? "Nessuna merce disponibile" : "Seleziona una merce"}
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
          Quantita (in unita della merce)
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
        disabled={products.length === 0}
        className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {submitLabel}
      </button>
    </form>
  );
}
