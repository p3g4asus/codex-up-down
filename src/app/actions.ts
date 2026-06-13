"use server";

import { ContainerType, MovementType, Prisma, UnitOfMeasure } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { isContainerType } from "@/lib/containers";
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

function parseContainer(value: string, redirectPath: string) {
  if (!isContainerType(value)) {
    redirectWithMessage(redirectPath, "error", "Seleziona un contenitore valido.");
  }

  return value as ContainerType;
}

function parseProductCode(value: string, redirectPath: string) {
  if (!value) {
    redirectWithMessage(redirectPath, "error", "Il codice articolo e obbligatorio.");
  }

  if (!/^[0-9]+$/.test(value)) {
    redirectWithMessage(redirectPath, "error", "Il codice articolo deve contenere solo numeri.");
  }

  return value;
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
  code: string,
  plu: number | null,
  unit: UnitOfMeasure,
  container: ContainerType,
  redirectPath: string,
) {
  if (!name || !code || !plu || !unit || !container) {
    redirectWithMessage(
      redirectPath,
      "error",
      "Nome, codice articolo, PLU, contenitore e unita di misura sono obbligatori.",
    );
  }
}

const EDITABLE_MOVEMENT_WINDOW_MS = 5 * 60 * 1000;

function parsePositiveNumberOrRedirect(
  value: string,
  fieldName: string,
  redirectPath: string,
) {
  try {
    return parsePositiveNumber(value, fieldName);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Valore non valido.";
    redirectWithMessage(redirectPath, "error", message);
  }
}

function ensureMovementCanBeChanged(
  movementCreatedAt: Date,
  latestMovementId: number | undefined,
  movementId: number,
) {
  if (!latestMovementId || latestMovementId !== movementId) {
    throw new Error("Puoi modificare o eliminare solo l'ultimo movimento cronologico della merce.");
  }

  const elapsedMs = Date.now() - movementCreatedAt.getTime();
  if (elapsedMs > EDITABLE_MOVEMENT_WINDOW_MS) {
    throw new Error("Sono trascorsi piu di 5 minuti: movimento non piu modificabile o eliminabile.");
  }
}

export async function createProduct(formData: FormData) {
  const name = getStringValue(formData, "name");
  const code = parseProductCode(getStringValue(formData, "code"), "/merci/nuova");
  const plu = parsePositiveNumberOrRedirect(
    getStringValue(formData, "plu"),
    "Il PLU",
    "/merci/nuova",
  );
  const description = getStringValue(formData, "description");
  const container = parseContainer(getStringValue(formData, "container"), "/merci/nuova");
  const unit = parseUnit(getStringValue(formData, "unit"), "/merci/nuova");
  const alertThreshold = parseOptionalPositiveNumber(
    getStringValue(formData, "alertThreshold"),
    "La soglia di alert",
    "/merci/nuova",
  );

  validateProductPayload(name, code, plu, unit, container, "/merci/nuova");

  try {
    await prisma.product.create({
      data: {
        name,
        code,
        plu,
        description: description || null,
        container,
        unit,
        alertThreshold,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithMessage("/merci/nuova", "error", `La merce ${name} esiste già.`);
    }

    redirectWithMessage("/merci/nuova", "error", "Impossibile salvare la merce.");
  }

  refreshInventoryViews();
  redirectWithMessage("/merci/nuova", "success", `Merce ${name} registrata.`);
}

export async function updateProduct(formData: FormData) {
  const productId = parsePositiveNumber(getStringValue(formData, "productId"), "La merce");
  const name = getStringValue(formData, "name");
  const code = parseProductCode(getStringValue(formData, "code"), `/merci/${productId}/modifica`);
  const plu = parsePositiveNumberOrRedirect(
    getStringValue(formData, "plu"),
    "Il PLU",
    `/merci/${productId}/modifica`,
  );
  const description = getStringValue(formData, "description");
  const fallbackEditPath = `/merci/${productId}/modifica`;
  const returnPath = getReturnPath(formData, "/merci");
  const errorPath = withQueryParams(
    fallbackEditPath,
    new URLSearchParams(returnPath ? { returnTo: returnPath } : {}),
  );
  const container = parseContainer(getStringValue(formData, "container"), errorPath);
  const unit = parseUnit(getStringValue(formData, "unit"), errorPath);
  const alertThreshold = parseOptionalPositiveNumber(
    getStringValue(formData, "alertThreshold"),
    "La soglia di alert",
    errorPath,
  );

  validateProductPayload(name, code, plu, unit, container, errorPath);

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
          code,
          plu,
        description: description || null,
          container,
        unit,
        alertThreshold,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithMessage(errorPath, "error", `La merce ${name} esiste già.`);
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

export async function updateLatestMovementQuantity(formData: FormData) {
  const returnPath = getReturnPath(formData, "/storico");
  const movementId = parsePositiveNumberOrRedirect(
    getStringValue(formData, "movementId"),
    "Il movimento",
    returnPath,
  );
  const quantity = parsePositiveNumberOrRedirect(
    getStringValue(formData, "quantity"),
    "La quantita",
    returnPath,
  );

  try {
    await prisma.$transaction(async (transaction) => {
      const movement = await transaction.movement.findUnique({
        where: { id: movementId },
        include: { product: true },
      });

      if (!movement) {
        throw new Error("Il movimento selezionato non esiste.");
      }

      const latestMovement = await transaction.movement.findFirst({
        where: { productId: movement.productId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });

      ensureMovementCanBeChanged(movement.createdAt, latestMovement?.id, movement.id);

      const nextStock =
        movement.type === MovementType.LOAD
          ? movement.product.stock - movement.quantity + quantity
          : movement.product.stock + movement.quantity - quantity;

      if (nextStock < 0) {
        throw new Error(
          `Operazione non valida: la nuova quantita porterebbe la giacenza di ${movement.product.name} sotto zero.`,
        );
      }

      await transaction.movement.update({
        where: { id: movement.id },
        data: { quantity },
      });

      await transaction.product.update({
        where: { id: movement.productId },
        data: { stock: nextStock },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossibile aggiornare il movimento.";
    redirectWithMessage(returnPath, "error", message);
  }

  refreshInventoryViews();
  redirectWithMessage(returnPath, "success", "Movimento aggiornato con successo.");
}

export async function deleteLatestMovement(formData: FormData) {
  const returnPath = getReturnPath(formData, "/storico");
  const movementId = parsePositiveNumberOrRedirect(
    getStringValue(formData, "movementId"),
    "Il movimento",
    returnPath,
  );

  try {
    await prisma.$transaction(async (transaction) => {
      const movement = await transaction.movement.findUnique({
        where: { id: movementId },
        include: { product: true },
      });

      if (!movement) {
        throw new Error("Il movimento selezionato non esiste.");
      }

      const latestMovement = await transaction.movement.findFirst({
        where: { productId: movement.productId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });

      ensureMovementCanBeChanged(movement.createdAt, latestMovement?.id, movement.id);

      const nextStock =
        movement.type === MovementType.LOAD
          ? movement.product.stock - movement.quantity
          : movement.product.stock + movement.quantity;

      if (nextStock < 0) {
        throw new Error(
          `Operazione non valida: l'eliminazione porterebbe la giacenza di ${movement.product.name} sotto zero.`,
        );
      }

      await transaction.movement.delete({
        where: { id: movement.id },
      });

      await transaction.product.update({
        where: { id: movement.productId },
        data: { stock: nextStock },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossibile eliminare il movimento.";
    redirectWithMessage(returnPath, "error", message);
  }

  refreshInventoryViews();
  redirectWithMessage(returnPath, "success", "Movimento eliminato con successo.");
}
