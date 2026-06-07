import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function randomCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}

function randomPlu() {
  return Math.floor(100000 + Math.random() * 900000);
}

async function generateUniqueCode() {
  for (;;) {
    const code = randomCode();
    const existing = await prisma.product.findUnique({ where: { code }, select: { id: true } });
    if (!existing) {
      return code;
    }
  }
}

async function generateUniquePlu() {
  for (;;) {
    const plu = randomPlu();
    const existing = await prisma.product.findUnique({ where: { plu }, select: { id: true } });
    if (!existing) {
      return plu;
    }
  }
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [{ code: null }, { plu: null }],
    },
    select: {
      id: true,
      code: true,
      plu: true,
    },
  });

  for (const product of products) {
    const code = product.code ?? (await generateUniqueCode());
    const plu = product.plu ?? (await generateUniquePlu());

    await prisma.product.update({
      where: { id: product.id },
      data: { code, plu },
    });
  }

  console.log(`Backfill completato: ${products.length} merci aggiornate.`);
}

main()
  .catch((error) => {
    console.error("Errore backfill identificativi:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
