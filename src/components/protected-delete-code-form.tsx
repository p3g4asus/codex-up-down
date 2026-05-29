"use client";

import { useState, type FormEvent } from "react";

import { withBasePath } from "@/lib/base-path";
import { emitClientFeedback } from "@/lib/client-feedback";

export function ProtectedDeleteCodeForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSubmitting(true);

    try {
      const response = await fetch(withBasePath("/api/security/protected-delete-code"), {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { kind?: string; message?: string };
      const kind = payload.kind === "success" ? "success" : "error";
      const message = payload.message || "Operazione completata.";

      emitClientFeedback({ kind, message });

      if (kind === "success") {
        form.reset();
      }
    } catch {
      emitClientFeedback({ kind: "error", message: "Impossibile contattare il server." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
      <h3 className="text-base font-semibold text-slate-900">Codice segreto eliminazione protetta</h3>
      <p className="text-xs leading-5 text-slate-600">
        Per cambiare il codice devi conoscere quello attuale. Regole minime: almeno 8 caratteri, una
        maiuscola, una minuscola e un numero.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="currentCode" className="text-sm font-semibold text-slate-900">
            Codice attuale
          </label>
          <input
            id="currentCode"
            name="currentCode"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="nextCode" className="text-sm font-semibold text-slate-900">
            Nuovo codice
          </label>
          <input
            id="nextCode"
            name="nextCode"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmNextCode" className="text-sm font-semibold text-slate-900">
            Conferma nuovo codice
          </label>
          <input
            id="confirmNextCode"
            name="confirmNextCode"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Aggiornamento..." : "Aggiorna codice segreto"}
      </button>
    </form>
  );
}
