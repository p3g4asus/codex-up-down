"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { withBasePath } from "@/lib/base-path";
import { emitClientFeedback } from "@/lib/client-feedback";

type DeleteMovementButtonProps = {
  movementId: number;
  productName: string;
};

export function DeleteMovementButton({
  movementId,
  productName,
}: DeleteMovementButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalTitleId = useId();
  const router = useRouter();

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
    formData.set("movementId", String(movementId));

    setIsSubmitting(true);

    try {
      const response = await fetch(withBasePath("/api/movements"), {
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
        className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 transition hover:bg-rose-100"
      >
        Elimina movimento
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
                  <form onSubmit={handleDelete}>
                    <input type="hidden" name="movementId" value={movementId} />
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
