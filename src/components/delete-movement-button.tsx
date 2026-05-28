"use client";

import { useId, useState } from "react";

import { deleteLatestMovement } from "@/app/actions";

type DeleteMovementButtonProps = {
  movementId: number;
  productName: string;
  returnTo: string;
};

export function DeleteMovementButton({
  movementId,
  productName,
  returnTo,
}: DeleteMovementButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const modalTitleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 transition hover:bg-rose-100"
      >
        Elimina movimento
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl"
          >
            <div className="space-y-3">
              <h2 id={modalTitleId} className="text-xl font-semibold text-slate-950">
                Conferma eliminazione movimento
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Stai per eliminare l&apos;ultimo movimento di {productName}. Questa operazione non puo essere annullata.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                Annulla
              </button>
              <form action={deleteLatestMovement}>
                <input type="hidden" name="movementId" value={movementId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button
                  type="submit"
                  className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                >
                  Conferma eliminazione
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
