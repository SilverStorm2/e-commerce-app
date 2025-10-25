export const CONTRACTOR_SKILLS = [
  "store_setup",
  "performance_marketing",
  "copywriting",
  "logistics",
  "design",
  "customer_support",
] as const;

export const CONTRACTOR_SERVICE_AREAS = [
  "remote",
  "mazowieckie",
  "malopolskie",
  "slaskie",
  "pomorskie",
] as const;

export type ContractorSkill = (typeof CONTRACTOR_SKILLS)[number];
export type ContractorServiceArea = (typeof CONTRACTOR_SERVICE_AREAS)[number];

export const CONTRACTOR_DIRECTORY_LIMIT = 24;

export function isContractorSkill(value: unknown): value is ContractorSkill {
  return typeof value === "string" && (CONTRACTOR_SKILLS as readonly string[]).includes(value);
}

export function isContractorServiceArea(value: unknown): value is ContractorServiceArea {
  return (
    typeof value === "string" && (CONTRACTOR_SERVICE_AREAS as readonly string[]).includes(value)
  );
}
