import { UnitOfMeasure } from "@prisma/client";

export const unitOptions: UnitOfMeasure[] = [
  UnitOfMeasure.CONFEZIONE,
  UnitOfMeasure.MILLILITRI,
  UnitOfMeasure.LITRI,
  UnitOfMeasure.GRAMMI,
  UnitOfMeasure.ETTI,
  UnitOfMeasure.KG,
];

export const unitLabels: Record<UnitOfMeasure, string> = {
  [UnitOfMeasure.CONFEZIONE]: "Confezioni",
  [UnitOfMeasure.MILLILITRI]: "ml",
  [UnitOfMeasure.LITRI]: "l",
  [UnitOfMeasure.GRAMMI]: "g",
  [UnitOfMeasure.ETTI]: "hg",
  [UnitOfMeasure.KG]: "kg",
};

export function isUnitOfMeasure(value: string): value is UnitOfMeasure {
  return unitOptions.includes(value as UnitOfMeasure);
}
