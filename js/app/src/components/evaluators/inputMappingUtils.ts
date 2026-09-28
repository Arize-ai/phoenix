import type { EvaluatorInputMapping } from "@phoenix/types";

/** Returns whether a mapping value survives persistence. */
export function hasMappingValue(value: unknown): boolean {
  return value != null && value !== "";
}

/** Removes paths shadowed by literal mappings, matching server precedence. */
export function normalizeInputMapping(
  mapping: EvaluatorInputMapping
): EvaluatorInputMapping {
  const pathMapping = { ...mapping.pathMapping };

  for (const [name, value] of Object.entries(mapping.literalMapping)) {
    if (hasMappingValue(value)) {
      delete pathMapping[name];
    }
  }

  return { ...mapping, pathMapping };
}
