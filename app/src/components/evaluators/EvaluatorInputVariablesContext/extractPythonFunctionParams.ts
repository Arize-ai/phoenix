import type { EvaluatorParam } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";

const DEF_REGEX = /def\s+evaluate\s*\(([^)]*)\)/;

type JsonSchemaType = NonNullable<EvaluatorParam["type"]>;

/**
 * Maps Python type annotation names to JSON Schema type strings.
 * Mirrors the backend `_PYTHON_TYPE_TO_JSON_SCHEMA` mapping.
 */
const PYTHON_TYPE_TO_JSON_SCHEMA: Record<string, JsonSchemaType> = {
  str: "string",
  int: "integer",
  float: "number",
  bool: "boolean",
  list: "array",
  List: "array",
  dict: "object",
  Dict: "object",
};

/**
 * Extracts the JSON Schema type from a raw Python type annotation string.
 *
 * Handles:
 * - Simple types: `str`, `int`, `float`, `bool`, `list`, `dict`, etc.
 * - Optional types: `Optional[X]` - extracts inner type X
 * - Generic subscript types: `List[str]`, `Dict[str, int]` - uses the outer type
 * - Unrecognized / missing annotations - returns `undefined`
 */
function pythonTypeToJsonSchema(
  annotation: string | undefined
): JsonSchemaType | undefined {
  if (!annotation) {
    return undefined;
  }

  const trimmed = annotation.trim();
  if (!trimmed) {
    return undefined;
  }

  // Handle Optional[X] - extract the inner type
  const optionalMatch = trimmed.match(/^Optional\[(.+)\]$/);
  if (optionalMatch) {
    return pythonTypeToJsonSchema(optionalMatch[1]);
  }

  // Handle generic subscript types like List[str], Dict[str, int]
  // Use the outer type name for the mapping
  const subscriptMatch = trimmed.match(/^(\w+)\[.+\]$/);
  if (subscriptMatch) {
    return PYTHON_TYPE_TO_JSON_SCHEMA[subscriptMatch[1]];
  }

  // Simple type name
  return PYTHON_TYPE_TO_JSON_SCHEMA[trimmed];
}

/**
 * Extracts parameter names and type annotations from the first Python `def`
 * signature in a code string.
 */
export function extractPythonFunctionParams(
  sourceCode: string
): EvaluatorParam[] {
  const match = sourceCode.match(DEF_REGEX);
  if (!match || !match[1]) {
    return [];
  }
  return match[1]
    .split(",")
    .map((param) => {
      // Strip defaults first (e.g., `x: int = 5` -> `x: int`)
      const withoutDefault = param.replace(/=.*/, "");
      // Strip * and ** prefixes
      const withoutStars = withoutDefault.replace(/^\s*\*+/, "");
      // Split on the first `:` to separate name from annotation
      const colonIndex = withoutStars.indexOf(":");
      let name: string;
      let annotation: string | undefined;
      if (colonIndex >= 0) {
        name = withoutStars.slice(0, colonIndex).trim();
        annotation = withoutStars.slice(colonIndex + 1).trim();
      } else {
        name = withoutStars.trim();
        annotation = undefined;
      }
      return { name, type: pythonTypeToJsonSchema(annotation) };
    })
    .filter(
      (param) =>
        param.name !== "" && param.name !== "self" && param.name !== "cls"
    );
}
