"use server";

import { MovementType, Prisma, UnitOfMeasure } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { isUnitOfMeasure, unitLabels } from "@/lib/units";

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function withQueryParams(path: string, params: URLSearchParams) {
  const query = params.toString();
  if (!query) {
    return path;
  }

  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

function getReturnPath(formData: FormData, fallbackPath: string) {
  const value = getStringValue(formData, "returnTo");

  if (!value || !value.startsWith("/")) {
    return fallbackPath;
  }

  return value;
}

function redirectWithMessage(
  path: string,
  kind: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ kind, message });
  return redirect(withQueryParams(path, params));
}

function parsePositiveNumber(value: string, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} deve essere un numero intero maggiore di zero.`);
  }

  return parsed;
}

function parseOptionalPositiveNumber(value: string, fieldName: string, redirectPath: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    redirectWithMessage(
      redirectPath,
      "error",
      `${fieldName} deve essere un numero intero maggiore di zero oppure vuoto.`,
    );
  }

  return parsed;
}

function parseUnit(value: string, redirectPath: string) {
  if (!isUnitOfMeasure(value)) {
    redirectWithMessage(redirectPath, "error", "Seleziona unita di misura valida.");
  }

  return value as UnitOfMeasure;
}

function refreshInventoryViews() {
  revalidatePath("/");
  revalidatePath("/storico");
  revalidatePath("/merci");
  revalidatePath("/merci/nuova");
  revalidatePath("/carico");
  revalidatePath("/scarico");
}

function validateProductPayload(
  name: string,
  unit: UnitOfMeasure,
  redirectPath: string,
) {
  if (!name || !unit) {
    redirectWithMessage(
      redirectPath,
      "error",
      "Nome e unita di misura sono obbligatori.",
    );
  }
}

export async function createProduct(formData: FormData) {
  const name = getStringValue(formData, "name");
  const description = getStringValue(formData, "description");
  const unit = parseUnit(getStringValue(formData, "unit"), "/merci/nuova");
  const alertThreshold = parseOptionalPositiveNumber(
    getStringValue(formData, "alertThreshold"),
    "La soglia di alert",
    "/merci/nuova",
  );

  validateProductPayload(name, unit, "/merci/nuova");

  try {
    await prisma.product.create({
      data: {
        name,
        description: description || null,
        unit,
        alertThreshold,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithMessage("/merci/nuova", "error", `La merce ${name} esiste gia.`);
    }

    redirectWithMessage("/merci/nuova", "error", "Impossibile salvare la merce.");
  }

  refreshInventoryViews();
  redirectWithMessage("/merci/nuova", "success", `Merce ${name} registrata.`);
}

export async function updateProduct(formData: FormData) {
  const productId = parsePositiveNumber(getStringValue(formData, "productId"), "La merce");
  const name = getStringValue(formData, "name");
  const description = getStringValue(formData, "description");
  const fallbackEditPath = `/merci/${productId}/modifica`;
  const returnPath = getReturnPath(formData, "/merci");
  const errorPath = withQueryParams(
    fallbackEditPath,
    new URLSearchParams(returnPath ? { returnTo: returnPath } : {}),
  );
  const unit = parseUnit(getStringValue(formData, "unit"), errorPath);
  const alertThreshold = parseOptionalPositiveNumber(
    getStringValue(formData, "alertThreshold"),
    "La soglia di alert",
    errorPath,
  );

  validateProductPayload(name, unit, errorPath);

  const currentProduct = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      _count: {
        select: {
          movements: true,
        },
      },
    },
  });

  if (!currentProduct) {
    redirectWithMessage(errorPath, "error", "La merce selezionata non esiste.");
  }

  if (currentProduct._count.movements > 0 && currentProduct.unit !== unit) {
    redirectWithMessage(
      errorPath,
      "error",
      "Non puoi cambiare l'unita di misura di una merce con movimenti gia registrati.",
    );
  }

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        description: description || null,
        unit,
        alertThreshold,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithMessage(errorPath, "error", `La merce ${name} esiste gia.`);
    }

    redirectWithMessage(errorPath, "error", "Impossibile aggiornare la merce.");
  }

  refreshInventoryViews();
  revalidatePath(fallbackEditPath);
  redirectWithMessage(returnPath, "success", `Merce ${name} aggiornata.`);
}

export async function deleteProduct(formData: FormData) {
  const productId = parsePositiveNumber(getStringValue(formData, "productId"), "La merce");
  const returnPath = getReturnPath(formData, "/merci");
  const unit = parseUnit(getStringValue(formData, "unit"), returnPath);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      _count: {
        select: {
          movements: true,
        },
      },
    },
  });

  if (!product) {
    redirectWithMessage(returnPath, "error", "La merce selezionata non esiste.");
  }

  if (product._count.movements > 0) {
    redirectWithMessage(
      returnPath,
      "error",
      "Non puoi eliminare una merce che ha movimenti registrati nello storico.",
    );
  }

  if (product.unit !== unit) {
    redirectWithMessage(
      returnPath,
      "error",
      "L'unita di misura selezionata non corrisponde alla merce da eliminare.",
    );
  }

  try {
    await prisma.product.delete({
      where: { id: productId },
    });
  } catch {
    redirectWithMessage(returnPath, "error", "Impossibile eliminare la merce.");
  }

  refreshInventoryViews();
  redirectWithMessage(returnPath, "success", `Merce ${product.name} eliminata.`);
}

async function saveMovement(
  type: MovementType,
  formData: FormData,
  successPath: string,
  successMessage: string,
) {
  const productId = parsePositiveNumber(getStringValue(formData, "productId"), "La merce");
  const quantity = parsePositiveNumber(getStringValue(formData, "quantity"), "La quantita");
  const note = getStringValue(formData, "note");

  try {
    await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error("La merce selezionata non esiste.");
      }

      if (type === MovementType.UNLOAD && product.stock < quantity) {
        throw new Error(
          `Disponibilita insufficiente per ${product.name}. Giacenza attuale: ${product.stock} ${unitLabels[product.unit]}.`,
        );
      }

      await transaction.movement.create({
        data: {
          type,
          quantity,
          note: note || null,
          productId,
        },
      });

      await transaction.product.update({
        where: { id: productId },
        data: {
          stock: type === MovementType.LOAD ? product.stock + quantity : product.stock - quantity,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operazione non completata.";
    redirectWithMessage(successPath, "error", message);
  }

  refreshInventoryViews();
  redirectWithMessage(successPath, "success", successMessage);
}

export async function registerLoad(formData: FormData) {
  await saveMovement(
    MovementType.LOAD,
    formData,
    "/carico",
    "Carico registrato con successo.",
  );
}

export async function registerUnload(formData: FormData) {
  await saveMovement(
    MovementType.UNLOAD,
    formData,
    "/scarico",
    "Scarico registrato con successo.",
  );
}
