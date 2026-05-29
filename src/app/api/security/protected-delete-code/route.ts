import { NextResponse } from "next/server";

import {
  updateProtectedDeleteCode,
  validateProtectedDeleteCodeComplexity,
} from "@/lib/protected-delete-code";

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ kind: "error", message }, { status });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const currentCode = getStringValue(formData, "currentCode");
    const nextCode = getStringValue(formData, "nextCode");
    const confirmNextCode = getStringValue(formData, "confirmNextCode");

    if (!currentCode || !nextCode || !confirmNextCode) {
      return jsonError("Compila tutti i campi richiesti.");
    }

    if (nextCode !== confirmNextCode) {
      return jsonError("Il nuovo codice e la conferma non coincidono.");
    }

    const complexity = validateProtectedDeleteCodeComplexity(nextCode);
    if (!complexity.valid) {
      return jsonError(complexity.message || "Nuovo codice non valido.");
    }

    await updateProtectedDeleteCode(currentCode, nextCode);

    return NextResponse.json({
      kind: "success",
      message: "Codice segreto aggiornato correttamente.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossibile aggiornare il codice segreto.";
    return jsonError(message);
  }
}
