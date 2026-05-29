import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

const PROTECTED_DELETE_CODE_KEY = "protected_delete_code_hash";

export type ProtectedDeleteCodeComplexityResult = {
  valid: boolean;
  message?: string;
};

function hashCode(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function readStoredCodeHash() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: PROTECTED_DELETE_CODE_KEY },
    select: { value: true },
  });

  return setting?.value ?? null;
}

function readEnvCode() {
  return (process.env.PROTECTED_DELETE_CODE || "").trim();
}

export function validateProtectedDeleteCodeComplexity(code: string): ProtectedDeleteCodeComplexityResult {
  if (code.length < 8) {
    return { valid: false, message: "Il codice deve contenere almeno 8 caratteri." };
  }

  if (!/[a-z]/.test(code)) {
    return { valid: false, message: "Il codice deve contenere almeno una lettera minuscola." };
  }

  if (!/[A-Z]/.test(code)) {
    return { valid: false, message: "Il codice deve contenere almeno una lettera maiuscola." };
  }

  if (!/\d/.test(code)) {
    return { valid: false, message: "Il codice deve contenere almeno un numero." };
  }

  return { valid: true };
}

export async function verifyProtectedDeleteCode(inputCode: string) {
  const normalized = inputCode.trim();
  if (!normalized) {
    return false;
  }

  const storedHash = await readStoredCodeHash();
  if (storedHash) {
    return hashCode(normalized) === storedHash;
  }

  const envCode = readEnvCode();
  return Boolean(envCode) && envCode === normalized;
}

export async function ensureProtectedDeleteCode(inputCode: string) {
  const matches = await verifyProtectedDeleteCode(inputCode);

  if (!matches) {
    throw new Error("Codice segreto non valido: eliminazione bloccata.");
  }
}

export async function isProtectedDeleteCodeConfigured() {
  const storedHash = await readStoredCodeHash();
  if (storedHash) {
    return true;
  }

  return Boolean(readEnvCode());
}

export async function updateProtectedDeleteCode(currentCode: string, nextCode: string) {
  const currentCodeIsValid = await verifyProtectedDeleteCode(currentCode);
  if (!currentCodeIsValid) {
    throw new Error("Codice attuale non valido.");
  }

  const complexity = validateProtectedDeleteCodeComplexity(nextCode);
  if (!complexity.valid) {
    throw new Error(complexity.message || "Nuovo codice non valido.");
  }

  await prisma.appSetting.upsert({
    where: { key: PROTECTED_DELETE_CODE_KEY },
    create: {
      key: PROTECTED_DELETE_CODE_KEY,
      value: hashCode(nextCode.trim()),
    },
    update: {
      value: hashCode(nextCode.trim()),
    },
  });
}
