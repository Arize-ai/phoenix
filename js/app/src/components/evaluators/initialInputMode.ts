export type EvaluatorInputMappingMode = "path" | "literal";

/**
 * Infers an input row's initial mode from the mapping value that survived its
 * previous mount. Literal values are persisted separately from the row state,
 * so the mode must be derived from them when a prompt variable reappears.
 */
export function getInitialEvaluatorInputMode(
  literalMapping: Record<string, unknown>,
  variable: string
): EvaluatorInputMappingMode {
  return Object.prototype.hasOwnProperty.call(literalMapping, variable)
    ? "literal"
    : "path";
}
