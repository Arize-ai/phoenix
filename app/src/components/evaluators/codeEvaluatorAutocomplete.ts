import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";

import type { EvaluatorMappingSource } from "@phoenix/types";
import { flattenObject } from "@phoenix/utils/jsonUtils";

/**
 * Generates a human-readable type description for a value.
 */
function getTypeDescription(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) {
    if (value.length === 0) return "array (empty)";
    return `array (${value.length} items)`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length <= 3) return `object { ${keys.join(", ")} }`;
    return `object (${keys.length} keys)`;
  }
  if (typeof value === "string") {
    if (value.length > 30) return `string: "${value.slice(0, 30)}..."`;
    return `string: "${value}"`;
  }
  if (typeof value === "number") return `number: ${value}`;
  if (typeof value === "boolean") return `boolean: ${value}`;
  return typeof value;
}

/**
 * Creates autocomplete options from the evaluator mapping source.
 */
export function createCompletionOptions({
  mappingSource,
  language,
}: {
  mappingSource: EvaluatorMappingSource;
  language: "PYTHON" | "TYPESCRIPT";
}): Completion[] {
  const options: Completion[] = [];

  // Add top-level parameter completions
  const topLevelParams = [
    {
      name: "output",
      data: mappingSource.output,
      info: "The output from the task being evaluated",
    },
    {
      name: "reference",
      data: mappingSource.reference,
      info: "The expected/reference output from the dataset",
    },
    {
      name: "input",
      data: mappingSource.input,
      info: "The input provided to the task",
    },
    {
      name: "metadata",
      data: mappingSource.metadata,
      info: "Additional metadata from the dataset",
    },
  ];

  for (const { name, data, info } of topLevelParams) {
    options.push({
      label: name,
      type: "variable",
      info,
      boost: 10, // Boost top-level params
    });

    // Add nested field completions
    if (data && typeof data === "object" && Object.keys(data).length > 0) {
      const flattened = flattenObject({
        obj: data as Record<string, unknown>,
        parentKey: name,
        keepNonTerminalValues: true,
        formatIndices: true,
      }) as Record<string, unknown>;
      for (const [path, value] of Object.entries(flattened)) {
        options.push({
          label: path,
          type: "property",
          info: getTypeDescription(value),
          boost: 5,
        });
      }
    }
  }

  // Add language-specific helper completions
  if (language === "PYTHON") {
    options.push(
      {
        label: ".get(",
        type: "method",
        info: "Safely get a dict value with optional default",
        apply: '.get("key", "")',
        boost: 3,
      },
      {
        label: "isinstance(",
        type: "function",
        info: "Check if value is an instance of a type",
        apply: "isinstance(output, dict)",
        boost: 2,
      }
    );
  } else {
    options.push(
      {
        label: "?.",
        type: "keyword",
        info: "Optional chaining operator",
        boost: 3,
      },
      {
        label: "typeof",
        type: "keyword",
        info: "Check the type of a value",
        apply: 'typeof output?.field === "string"',
        boost: 2,
      }
    );
  }

  return options;
}

/**
 * Creates a completion function for the code evaluator editor.
 */
function createEvaluatorCompletions(
  mappingSource: EvaluatorMappingSource,
  language: "PYTHON" | "TYPESCRIPT"
): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
    // Match word characters and dots (for nested access like output.answer)
    const word = context.matchBefore(/[\w.?]*/);
    if (!word) return null;

    // Don't autocomplete if we're not at a word boundary or explicit
    if (word.from === word.to && !context.explicit) return null;

    const options = createCompletionOptions({ mappingSource, language });

    // Filter options based on what's typed
    const typed = word.text.toLowerCase();
    const filteredOptions = typed
      ? options.filter((opt) => opt.label.toLowerCase().includes(typed))
      : options;

    if (filteredOptions.length === 0) return null;

    return {
      from: word.from,
      options: filteredOptions,
      validFor: /^[\w.?]*$/,
    };
  };
}

/**
 * Creates the autocompletion extension for the code evaluator editor.
 */
export function createEvaluatorAutocompletion(
  mappingSource: EvaluatorMappingSource,
  language: "PYTHON" | "TYPESCRIPT"
) {
  return autocompletion({
    override: [createEvaluatorCompletions(mappingSource, language)],
    activateOnTyping: true,
    maxRenderedOptions: 50,
  });
}
