"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { withBasePath } from "@/lib/base-path";
import { DeleteMovementButton } from "@/components/delete-movement-button";
import { emitClientFeedback } from "@/lib/client-feedback";

type MovementRowActionsProps = {
  movementId: number;
  productName: string;
  quantity: number;
  canEditOrDelete: boolean;
  requiresProtectedCode: boolean;
};

export function MovementRowActions({
  movementId,
  productName,
  quantity,
  canEditOrDelete,
  requiresProtectedCode,
}: MovementRowActionsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [protectedCode, setProtectedCode] = useState("");

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
    } catch {
      emitClientFeedback({ kind: "error", message: "Impossibile contattare il server." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canEditOrDelete) {
    return (
      <span className="text-xs text-slate-500">
        Modifica/eliminazione disponibile solo per l&apos;ultimo movimento della merce.
      </span>
    );
  }

  return (
    <div className="flex min-w-[240px] flex-col gap-2">
      <span
        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          requiresProtectedCode
            ? "bg-amber-100 text-amber-900"
            : "bg-emerald-100 text-emerald-900"
        }`}
      >
        {requiresProtectedCode ? "Codice richiesto" : "Codice non richiesto"}
      </span>
      <form onSubmit={handleUpdate} className="flex items-center gap-2">
        <input
          type="number"
          name="quantity"
          min={1}
          step={1}
          defaultValue={quantity}
          className="w-20 rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
        />
        {requiresProtectedCode ? (
          <input
            type="password"
            name="protectedDeleteCode"
            required
            placeholder="Codice segreto"
            value={protectedCode}
            onChange={(event) => setProtectedCode(event.currentTarget.value)}
            className="w-36 rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
          />
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "..." : "Modifica"}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        {requiresProtectedCode
          ? "Movimento oltre 5 minuti: serve il codice segreto."
          : "Movimento entro 5 minuti: codice segreto non richiesto."}
      </p>
      <DeleteMovementButton
        movementId={movementId}
        productName={productName}
        requiresProtectedCode={requiresProtectedCode}
        protectedCode={protectedCode}
        onProtectedCodeChange={setProtectedCode}
      />
    </div>
  );
}
