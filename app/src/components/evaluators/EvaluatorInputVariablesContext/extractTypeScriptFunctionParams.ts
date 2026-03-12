import type { EvaluatorParam } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";

/**
 * Regex to match TypeScript function declarations with destructured object parameter.
 * Matches patterns like:
 * - function evaluate({ output, input }: { output: string; input: string })
 * - function evaluate({ output, input })
 * - const evaluate = ({ output, input }: { ... }) => ...
 */
const FUNCTION_DESTRUCTURED_REGEX =
  /(?:function\s+evaluate|(?:const|let|var)\s+evaluate\s*=)\s*\(\s*\{\s*([^}]*)\}\s*(?::\s*\{([^}]*)\})?/;

/**
 * Regex to match TypeScript function declarations with a single object parameter.
 * Matches patterns like:
 * - function evaluate(inputs: { output: string; input: string })
 */
const FUNCTION_OBJECT_PARAM_REGEX =
  /(?:function\s+evaluate|(?:const|let|var)\s+evaluate\s*=)\s*\(\s*(\w+)\s*:\s*\{([^}]*)\}/;

type JsonSchemaType = NonNullable<EvaluatorParam["type"]>;

/**
 * Maps TypeScript type names to JSON Schema type strings.
 */
const TS_TYPE_TO_JSON_SCHEMA: Record<string, JsonSchemaType> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  object: "object",
  // Arrays
  "string[]": "array",
  "number[]": "array",
  "boolean[]": "array",
  "any[]": "array",
  Array: "array",
  // Records/objects
  Record: "object",
  Object: "object",
};

/**
 * Extracts the JSON Schema type from a TypeScript type annotation string.
 */
function tsTypeToJsonSchema(
  annotation: string | undefined
): JsonSchemaType | undefined {
  if (!annotation) {
    return undefined;
  }

  const trimmed = annotation.trim();
  if (!trimmed) {
    return undefined;
  }

  // Handle array types like string[], number[]
  if (trimmed.endsWith("[]")) {
    return "array";
  }

  // Handle Array<T> generic
  if (trimmed.startsWith("Array<")) {
    return "array";
  }

  // Handle Record<K, V>
  if (trimmed.startsWith("Record<")) {
    return "object";
  }

  // Handle union types with null/undefined (optional) - take the first non-null type
  if (trimmed.includes("|")) {
    const parts = trimmed.split("|").map((p) => p.trim());
    for (const part of parts) {
      if (part !== "null" && part !== "undefined") {
        return tsTypeToJsonSchema(part);
      }
    }
    return undefined;
  }

  // Simple type name
  return TS_TYPE_TO_JSON_SCHEMA[trimmed];
}

/**
 * Parses property declarations from a TypeScript object type literal.
 * E.g., "output: string; input: string" -> [["output", "string"], ["input", "string"]]
 */
function parseObjectTypeProperties(
  typeBody: string
): Array<[string, string | undefined]> {
  const properties: Array<[string, string | undefined]> = [];

  // Split by semicolons or newlines, handling both formats
  const parts = typeBody.split(/[;\n]/).filter((p) => p.trim());

  for (const part of parts) {
    const colonIndex = part.indexOf(":");
    if (colonIndex >= 0) {
      const name = part.slice(0, colonIndex).trim().replace(/\?$/, ""); // Remove optional marker
      const type = part.slice(colonIndex + 1).trim();
      if (name) {
        properties.push([name, type]);
      }
    }
  }

  return properties;
}

/**
 * Extracts parameter names and type annotations from a TypeScript function
 * that uses destructured object parameters.
 *
 * Supports:
 * - function evaluate({ output, input }: { output: string; input: string })
 * - function evaluate({ output, input })
 * - const evaluate = ({ output, input }: { ... }) => ...
 */
export function extractTypeScriptFunctionParams(
  sourceCode: string
): EvaluatorParam[] {
  // First, try to match destructured object parameter pattern
  const destructuredMatch = sourceCode.match(FUNCTION_DESTRUCTURED_REGEX);
  if (destructuredMatch) {
    const paramNames = destructuredMatch[1]
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith("...")); // Filter out rest params

    const typeBody = destructuredMatch[2];
    const typeMap = new Map<string, string | undefined>();

    if (typeBody) {
      for (const [name, type] of parseObjectTypeProperties(typeBody)) {
        typeMap.set(name, type);
      }
    }

    return paramNames.map((name) => ({
      name,
      type: tsTypeToJsonSchema(typeMap.get(name)),
    }));
  }

  // Try to match single object parameter pattern: evaluate(inputs: { ... })
  const objectParamMatch = sourceCode.match(FUNCTION_OBJECT_PARAM_REGEX);
  if (objectParamMatch) {
    const typeBody = objectParamMatch[2];
    const properties = parseObjectTypeProperties(typeBody);

    return properties.map(([name, type]) => ({
      name,
      type: tsTypeToJsonSchema(type),
    }));
  }

  return [];
}
