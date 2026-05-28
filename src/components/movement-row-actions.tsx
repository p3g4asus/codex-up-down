"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { DeleteMovementButton } from "@/components/delete-movement-button";
import { emitClientFeedback } from "@/lib/client-feedback";

type MovementRowActionsProps = {
  movementId: number;
  productName: string;
  quantity: number;
  canEditOrDelete: boolean;
};

export function MovementRowActions({
  movementId,
  productName,
  quantity,
  canEditOrDelete,
}: MovementRowActionsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("action", "update");
    formData.set("movementId", String(movementId));

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/movements", {
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
    } catch {
      emitClientFeedback({ kind: "error", message: "Impossibile contattare il server." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canEditOrDelete) {
    return (
      <span className="text-xs text-slate-500">
        Modifica/eliminazione disponibile solo per l&apos;ultimo movimento entro 5 minuti.
      </span>
    );
  }

  return (
    <div className="flex min-w-[240px] flex-col gap-2">
      <form onSubmit={handleUpdate} className="flex items-center gap-2">
        <input
          type="number"
          name="quantity"
          min={1}
          step={1}
          defaultValue={quantity}
          className="w-20 rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "..." : "Modifica"}
        </button>
      </form>
      <DeleteMovementButton movementId={movementId} productName={productName} />
    </div>
  );
}
