import { Prisma, UnitOfMeasure } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { isUnitOfMeasure } from "@/lib/units";

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

function parseOptionalPositiveNumber(value: string, fieldName: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} deve essere un numero intero maggiore di zero oppure vuoto.`);
  }

  return parsed;
}

function parseUnit(value: string) {
  if (!isUnitOfMeasure(value)) {
    throw new Error("Seleziona unita di misura valida.");
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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ kind: "error", message }, { status });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const action = getStringValue(formData, "action");
  const productIdValue = getStringValue(formData, "productId");

  try {
    if (action === "delete") {
      const productId = parsePositiveNumber(productIdValue, "La merce");
      const unit = parseUnit(getStringValue(formData, "unit"));

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          _count: {
            select: { movements: true },
          },
        },
      });

      if (!product) {
        throw new Error("La merce selezionata non esiste.");
      }

      if (product._count.movements > 0) {
        throw new Error("Non puoi eliminare una merce che ha movimenti registrati nello storico.");
      }

      if (product.unit !== unit) {
        throw new Error("L'unita di misura selezionata non corrisponde alla merce da eliminare.");
      }

      await prisma.product.delete({ where: { id: productId } });
      refreshInventoryViews();

      return NextResponse.json({ kind: "success", message: `Merce ${product.name} eliminata.` });
    }

    if (productIdValue) {
      const productId = parsePositiveNumber(productIdValue, "La merce");
      const name = getStringValue(formData, "name");
      const description = getStringValue(formData, "description");
      const unit = parseUnit(getStringValue(formData, "unit"));
      const alertThreshold = parseOptionalPositiveNumber(
        getStringValue(formData, "alertThreshold"),
        "La soglia di alert",
      );

      if (!name || !unit) {
        throw new Error("Nome e unita di misura sono obbligatori.");
      }

      const currentProduct = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          _count: {
            select: { movements: true },
          },
        },
      });

      if (!currentProduct) {
        throw new Error("La merce selezionata non esiste.");
      }

      if (currentProduct._count.movements > 0 && currentProduct.unit !== unit) {
        throw new Error("Non puoi cambiare l'unita di misura di una merce con movimenti gia registrati.");
      }

      await prisma.product.update({
        where: { id: productId },
        data: {
          name,
          description: description || null,
          unit,
          alertThreshold,
        },
      });

      refreshInventoryViews();
      revalidatePath(`/merci/${productId}/modifica`);

      return NextResponse.json({ kind: "success", message: `Merce ${name} aggiornata.` });
    }

    const name = getStringValue(formData, "name");
    const description = getStringValue(formData, "description");
    const unit = parseUnit(getStringValue(formData, "unit"));
    const alertThreshold = parseOptionalPositiveNumber(
      getStringValue(formData, "alertThreshold"),
      "La soglia di alert",
    );

    if (!name || !unit) {
      throw new Error("Nome e unita di misura sono obbligatori.");
    }

    await prisma.product.create({
      data: {
        name,
        description: description || null,
        unit,
        alertThreshold,
      },
    });

    refreshInventoryViews();
    return NextResponse.json({ kind: "success", message: `Merce ${name} registrata.` });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(`La merce ${getStringValue(formData, "name")} esiste già.`);
    }

    const message = error instanceof Error ? error.message : "Impossibile salvare la merce.";
    return jsonError(message);
  }
}
