import type { ContainerType } from "@prisma/client";

export const containerOptions: ContainerType[] = [
  "CASSETTA_BIANCA",
  "GASTRONORM_STD",
  "MEZZA_GASTRONORM",
  "GASTRONORM_ALTA",
  "SOTTOVUOTO",
  "ALTRO",
];

export const containerLabels: Record<ContainerType, string> = {
  CASSETTA_BIANCA: "cassetta bianca",
  GASTRONORM_STD: "gastronorm std",
  MEZZA_GASTRONORM: "mezza gastronorm",
  GASTRONORM_ALTA: "gastronorm alta",
  SOTTOVUOTO: "sottovuoto",
  ALTRO: "altro",
};

export function isContainerType(value: string): value is ContainerType {
  return containerOptions.includes(value as ContainerType);
}