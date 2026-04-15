import type { EvaluatorMappingSource } from "@phoenix/types";

/**
 * Infers a TypeScript type string from a JavaScript value.
 */
function inferTypeFromValue(value: unknown, indent = 0): string {
  const spaces = "  ".repeat(indent);

  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return "string";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "unknown[]";
    }
    // Infer type from first element
    const elementType = inferTypeFromValue(value[0], indent);
    return `${elementType}[]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return "Record<string, unknown>";
    }

    const innerSpaces = "  ".repeat(indent + 1);
    const properties = entries
      .map(([key, val]) => {
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
          ? key
          : `"${key}"`;
        return `${innerSpaces}${safeKey}: ${inferTypeFromValue(val, indent + 1)};`;
      })
      .join("\n");

    return `{\n${properties}\n${spaces}}`;
  }

  return "unknown";
}

/**
 * Generates TypeScript interface definitions from the evaluator mapping source.
 * Returns a read-only footer block to append to the code editor.
 */
export function generateTypeScriptTypes(
  mappingSource: EvaluatorMappingSource
): string {
  const lines: string[] = [
    "",
    "// ─────────────────────────────────────────────────────────────────────────────",
    "// Auto-generated types from dataset example (read-only)",
    "// These types reflect the structure of your dataset",
    "",
  ];

  // Generate type for each mapping source field if it has data
  const fields: Array<{ name: string; typeName: string; data: unknown }> = [
    { name: "input", typeName: "Input", data: mappingSource.input },
    { name: "output", typeName: "Output", data: mappingSource.output },
    { name: "reference", typeName: "Reference", data: mappingSource.reference },
    { name: "metadata", typeName: "Metadata", data: mappingSource.metadata },
  ];

  for (const { typeName, data } of fields) {
    if (data && typeof data === "object" && Object.keys(data).length > 0) {
      const typeBody = inferTypeFromValue(data, 0);
      lines.push(`type ${typeName} = ${typeBody};`);
      lines.push("");
    }
  }

  // Add the EvaluatorParams type that combines available fields
  const availableFields = fields.filter(
    (f) =>
      f.data && typeof f.data === "object" && Object.keys(f.data).length > 0
  );

  if (availableFields.length > 0) {
    lines.push("type EvaluatorParams = {");
    for (const { name, typeName } of availableFields) {
      lines.push(`  ${name}?: ${typeName};`);
    }
    lines.push("};");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Infers a Python type hint string from a JavaScript value.
 */
function inferPythonTypeFromValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "None";
  }

  if (typeof value === "string") {
    return "str";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? "int" : "float";
  }

  if (typeof value === "boolean") {
    return "bool";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "list";
    }
    const elementType = inferPythonTypeFromValue(value[0]);
    return `list[${elementType}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return "dict";
    }
    // For complex objects, use TypedDict representation in docstring
    return "dict";
  }

  return "Any";
}

/**
 * Generates a formatted dict structure description for Python docstrings.
 */
function formatPythonDictStructure(
  data: Record<string, unknown>,
  indent = 0
): string[] {
  const lines: string[] = [];
  const spaces = "    ".repeat(indent);

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      lines.push(`${spaces}"${key}": {`);
      lines.push(
        ...formatPythonDictStructure(
          value as Record<string, unknown>,
          indent + 1
        )
      );
      lines.push(`${spaces}}`);
    } else if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "object"
    ) {
      lines.push(`${spaces}"${key}": [`);
      lines.push(`${spaces}    {`);
      lines.push(
        ...formatPythonDictStructure(
          value[0] as Record<string, unknown>,
          indent + 2
        )
      );
      lines.push(`${spaces}    }`);
      lines.push(`${spaces}]`);
    } else {
      const typeHint = inferPythonTypeFromValue(value);
      lines.push(`${spaces}"${key}": ${typeHint}`);
    }
  }

  return lines;
}

/**
 * Generates Python docstring/type hints from the evaluator mapping source.
 * Returns a read-only footer block to append to the code editor.
 */
export function generatePythonTypes(
  mappingSource: EvaluatorMappingSource
): string {
  const lines: string[] = [
    "",
    "# ─────────────────────────────────────────────────────────────────────────────",
    '"""',
    "Auto-generated type information from dataset example (read-only)",
    "These types reflect the structure of your dataset",
    "",
  ];

  const fields: Array<{ name: string; data: unknown }> = [
    { name: "input", data: mappingSource.input },
    { name: "output", data: mappingSource.output },
    { name: "reference", data: mappingSource.reference },
    { name: "metadata", data: mappingSource.metadata },
  ];

  for (const { name, data } of fields) {
    if (data && typeof data === "object" && Object.keys(data).length > 0) {
      lines.push(`${name}: dict`);
      const structureLines = formatPythonDictStructure(
        data as Record<string, unknown>,
        1
      );
      if (structureLines.length > 0) {
        lines.push("    {");
        lines.push(...structureLines);
        lines.push("    }");
      }
      lines.push("");
    }
  }

  lines.push('"""');
  lines.push("");

  return lines.join("\n");
}

/**
 * Generates type definitions based on language.
 */
export function generateEvaluatorTypes(
  language: "PYTHON" | "TYPESCRIPT",
  mappingSource: EvaluatorMappingSource
): string {
  // Only generate types if there's meaningful data
  const hasData = Object.values(mappingSource).some(
    (data) => data && typeof data === "object" && Object.keys(data).length > 0
  );

  if (!hasData) {
    return "";
  }

  if (language === "PYTHON") {
    return generatePythonTypes(mappingSource);
  }

  return generateTypeScriptTypes(mappingSource);
}
