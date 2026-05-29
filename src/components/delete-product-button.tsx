"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { UnitOfMeasure } from "@prisma/client";
import { createPortal } from "react-dom";

import { withBasePath } from "@/lib/base-path";
import { emitClientFeedback } from "@/lib/client-feedback";
import { unitLabels, unitOptions } from "@/lib/units";

type DeleteProductButtonProps = {
  productId: number;
  productName: string;
  productUnit: UnitOfMeasure;
  movementCount?: number;
};

export function DeleteProductButton({
  productId,
  productName,
  productUnit,
  movementCount = 0,
}: DeleteProductButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalTitleId = useId();
  const router = useRouter();
  const requiresProtectedDeleteCode = movementCount > 0;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  async function handleDelete(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("action", "delete");
    formData.set("productId", String(productId));

    setIsSubmitting(true);

    try {
      const response = await fetch(withBasePath("/api/products"), {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { kind?: string; message?: string };
      const kind = payload.kind === "success" ? "success" : "error";
      const message = payload.message ?? "Operazione completata.";

      emitClientFeedback({ kind, message });
      if (kind === "success") {
        router.refresh();
      }
      setIsOpen(false);
    } catch {
      emitClientFeedback({ kind: "error", message: "Impossibile contattare il server." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
      >
        Elimina
      </button>

      {isMounted && isOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={modalTitleId}
                className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl"
              >
                <div className="space-y-3">
                  <h2 id={modalTitleId} className="text-xl font-semibold text-slate-950">
                    Conferma eliminazione
                  </h2>
                  <p className="text-sm leading-6 text-slate-600">
                    Stai per eliminare la merce {productName}. Questa operazione non puo essere annullata.
                  </p>
                  {requiresProtectedDeleteCode ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                      Questa merce ha {movementCount} movimenti nello storico: per eliminarla devi inserire il codice segreto di protezione.
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <label htmlFor={`unit-${productId}`} className="text-sm font-semibold text-slate-900">
                      Conferma unita di misura
                    </label>
                    <p className="text-xs text-slate-500">
                      Per sicurezza, seleziona l&apos;unita corretta della merce da eliminare.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                  >
                    Annulla
                  </button>
                  <form onSubmit={handleDelete}>
                    <input type="hidden" name="productId" value={productId} />
                    <select
                      id={`unit-${productId}`}
                      name="unit"
                      required
                      defaultValue={productUnit}
                      className="mb-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-accent"
                    >
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          {unitLabels[unit]}
                        </option>
                      ))}
                    </select>
                    {requiresProtectedDeleteCode ? (
                      <div className="mb-4 space-y-2">
                        <label htmlFor={`protected-delete-${productId}`} className="text-sm font-semibold text-slate-900">
                          Codice segreto eliminazione
                        </label>
                        <input
                          id={`protected-delete-${productId}`}
                          name="protectedDeleteCode"
                          type="password"
                          required
                          placeholder="Inserisci codice segreto"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-accent"
                        />
                      </div>
                    ) : null}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                    >
                      {isSubmitting ? "Eliminazione..." : "Conferma eliminazione"}
                    </button>
                  </form>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
