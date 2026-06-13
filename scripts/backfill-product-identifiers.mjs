import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const containerValues = [
  "CASSETTA_BIANCA",
  "GASTRONORM_STD",
  "MEZZA_GASTRONORM",
  "GASTRONORM_ALTA",
  "SOTTOVUOTO",
  "ALTRO",
];

function randomCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
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
    select: {
      id: true,
      plu: true,
    },
  });

  for (const product of products) {
    const code = await generateUniqueCode();
    const container = containerValues[Math.floor(Math.random() * containerValues.length)];
    const plu = product.plu ?? (await generateUniquePlu());

    await prisma.product.update({
      where: { id: product.id },
      data: { code, plu, container },
    });
  }

  console.log(`Backfill completato: ${products.length} articoli aggiornati.`);
}

main()
  .catch((error) => {
    console.error("Errore backfill identificativi:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
