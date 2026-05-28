import { MovementType } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveNumber(value: string, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} deve essere un numero intero maggiore di zero.`);
  }

  return parsed;
}

function refreshMovementViews() {
  revalidatePath("/");
  revalidatePath("/storico");
  revalidatePath("/carico");
  revalidatePath("/scarico");
  revalidatePath("/merci");
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ kind: "error", message }, { status });
}

async function ensureMovementCanBeChanged(movementId: number) {
  const movement = await prisma.movement.findUnique({
    where: { id: movementId },
    include: {
      product: true,
    },
  });

  if (!movement) {
    throw new Error("Il movimento selezionato non esiste.");
  }

  const latestMovement = await prisma.movement.findFirst({
    where: { productId: movement.productId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestMovement || latestMovement.id !== movement.id) {
    throw new Error("Puoi modificare solo l'ultimo movimento registrato per questa merce.");
  }

  const ageInMinutes = (Date.now() - movement.createdAt.getTime()) / 1000 / 60;
  if (ageInMinutes > 5) {
    throw new Error("Puoi modificare o eliminare un movimento solo entro 5 minuti dalla registrazione.");
  }

  return movement;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const action = getStringValue(formData, "action");

  try {
    if (action === "load" || action === "unload") {
      const productId = parsePositiveNumber(getStringValue(formData, "productId"), "La merce");
      const quantity = parsePositiveNumber(getStringValue(formData, "quantity"), "La quantita");
      const note = getStringValue(formData, "note");

      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new Error("La merce selezionata non esiste.");
      }

      if (action === "unload" && product.stock < quantity) {
        throw new Error(`Impossibile scaricare ${quantity}. Disponibile solo ${product.stock}.`);
      }

      const movementType = action === "load" ? MovementType.LOAD : MovementType.UNLOAD;
      await prisma.$transaction([
        prisma.movement.create({
          data: {
            productId,
            type: movementType,
            quantity,
            note: note || null,
          },
        }),
        prisma.product.update({
          where: { id: productId },
          data: {
            stock: action === "load" ? product.stock + quantity : product.stock - quantity,
          },
        }),
      ]);

      refreshMovementViews();
      return NextResponse.json({
        kind: "success",
        message:
          action === "load"
            ? `${quantity} unita registrate in carico per ${product.name}.`
            : `${quantity} unita registrate in scarico per ${product.name}.`,
      });
    }

    if (action === "update") {
      const movementId = parsePositiveNumber(getStringValue(formData, "movementId"), "Il movimento");
      const quantity = parsePositiveNumber(getStringValue(formData, "quantity"), "La quantita");

      const movement = await ensureMovementCanBeChanged(movementId);
      const product = movement.product;
      const quantityDelta = quantity - movement.quantity;
      const nextStock = movement.type === MovementType.LOAD ? product.stock + quantityDelta : product.stock - quantityDelta;

      if (nextStock < 0) {
        throw new Error(`La modifica porterebbe il magazzino di ${product.name} sotto zero.`);
      }

      await prisma.$transaction([
        prisma.movement.update({
          where: { id: movementId },
          data: { quantity },
        }),
        prisma.product.update({
          where: { id: product.id },
          data: { stock: nextStock },
        }),
      ]);

      refreshMovementViews();
      return NextResponse.json({ kind: "success", message: "Movimento aggiornato correttamente." });
    }

    if (action === "delete") {
      const movementId = parsePositiveNumber(getStringValue(formData, "movementId"), "Il movimento");

      const movement = await ensureMovementCanBeChanged(movementId);
      const product = movement.product;
      const nextStock = movement.type === MovementType.LOAD
        ? product.stock - movement.quantity
        : product.stock + movement.quantity;

      if (nextStock < 0) {
        throw new Error(`L'eliminazione porterebbe il magazzino di ${product.name} sotto zero.`);
      }

      await prisma.$transaction([
        prisma.movement.delete({ where: { id: movementId } }),
        prisma.product.update({
          where: { id: product.id },
          data: { stock: nextStock },
        }),
      ]);

      refreshMovementViews();
      return NextResponse.json({ kind: "success", message: "Movimento eliminato correttamente." });
    }

    return jsonError("Azione non supportata.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossibile salvare il movimento.";
    return jsonError(message);
  }
}
