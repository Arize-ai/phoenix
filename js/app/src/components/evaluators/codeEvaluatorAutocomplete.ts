import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSection,
} from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";

import {
  extractCodeEvaluatorVariablesFromState,
  getCodeEvaluatorCompletionPosition,
} from "@phoenix/components/evaluators/codeEvaluatorUtils";
import type {
  MaterializedEvaluatorContext,
  MaterializedEvaluatorContextEntry,
} from "@phoenix/components/evaluators/evaluatorContext";
import { toMemberPreview } from "@phoenix/components/evaluators/evaluatorPathCompletions";
import type {
  CodeEvaluatorLanguage,
  EvaluatorMappingSource,
} from "@phoenix/types";
import { flattenObject } from "@phoenix/utils/jsonUtils";

const EVALUATOR_INPUT_SECTION: CompletionSection = {
  name: "Evaluator input",
  rank: 1,
};

const RECORD_SECTION_BY_GRAIN: Record<
  MaterializedEvaluatorContext["grain"],
  CompletionSection
> = {
  span: { name: "From the span", rank: 2 },
  session: { name: "From the session", rank: 2 },
};

const UNSET_COMPLETION_TYPE = "code-evaluator-unset";

/** Generates a human-readable type description for a value. */
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

/** Creates the existing member-path and language-helper options. */
export function createCompletionOptions({
  mappingSource,
  language,
}: {
  mappingSource: EvaluatorMappingSource;
  language: CodeEvaluatorLanguage;
}): Completion[] {
  const options: Completion[] = [];
  const topLevelParams = [
    {
      name: "output",
      data: mappingSource.output,
      info: "The output from the task being evaluated",
    },
    ...("reference" in mappingSource
      ? [
          {
            name: "reference",
            data: mappingSource.reference,
            info: "The expected/reference output from the dataset",
          },
        ]
      : []),
    {
      name: "input",
      data: mappingSource.input,
      info: "The input provided to the task",
    },
    ...("metadata" in mappingSource
      ? [
          {
            name: "metadata",
            data: mappingSource.metadata,
            info: "Additional metadata from the evaluation source",
          },
        ]
      : []),
  ];

  for (const { name, data, info } of topLevelParams) {
    options.push({ label: name, type: "variable", info, boost: 10 });
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

/** Creates a completion function for the code evaluator editor. */
function createEvaluatorCompletions({
  mappingSource,
  language,
  evaluationContext,
}: {
  mappingSource: EvaluatorMappingSource;
  language: CodeEvaluatorLanguage;
  evaluationContext: MaterializedEvaluatorContext | null;
}): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
    const position = getCodeEvaluatorCompletionPosition({
      language,
      state: context.state,
      pos: context.pos,
    });
    if (position === null) {
      return null;
    }

    const word = context.matchBefore(/[\w.?]*/);
    if (!word) {
      return null;
    }
    const declaredNames = extractCodeEvaluatorVariablesFromState({
      language,
      state: context.state,
    });
    let options: Completion[];

    if (position === "signature") {
      options = createSignatureOptions({
        mappingSource,
        language,
        evaluationContext,
        declaredNames,
      });
    } else if (word.text.includes(".") || word.text.includes("?")) {
      options = createMemberOptions({
        mappingSource,
        language,
        declaredNames,
      });
    } else {
      options = createBodyOptions({ declaredNames, evaluationContext });
    }

    const typed = word.text.toLowerCase();
    const filteredOptions = typed
      ? options.filter((option) => option.label.toLowerCase().includes(typed))
      : options;
    if (filteredOptions.length === 0) {
      return null;
    }
    if (
      position !== "signature" &&
      word.from === word.to &&
      !context.explicit
    ) {
      return null;
    }

    return {
      from: word.from,
      options: filteredOptions,
      validFor: /^[\w.?]*$/,
    };
  };
}

function createSignatureOptions({
  mappingSource,
  language,
  evaluationContext,
  declaredNames,
}: {
  mappingSource: EvaluatorMappingSource;
  language: CodeEvaluatorLanguage;
  evaluationContext: MaterializedEvaluatorContext | null;
  declaredNames: string[];
}): Completion[] {
  const declared = new Set(declaredNames);
  if (evaluationContext === null) {
    return createCompletionOptions({ mappingSource, language })
      .filter(
        (option) =>
          !option.label.includes(".") &&
          !option.label.includes("(") &&
          !option.label.includes("?") &&
          !declared.has(option.label)
      )
      .map((option, index) => ({
        ...option,
        section: EVALUATOR_INPUT_SECTION,
        boost: 100 - index,
      }));
  }

  const evaluatorInputs = evaluationContext.evaluatorInputs
    .filter(({ name }) => !declared.has(name))
    .map((entry, index) =>
      toEvaluatorInputCompletion({
        entry,
        evaluationContext,
        index,
      })
    );
  const recordVariables = evaluationContext.recordVariables
    .filter(({ name }) => !declared.has(name))
    .map((entry, index) =>
      toRecordVariableCompletion({ entry, evaluationContext, index })
    );
  return [...evaluatorInputs, ...recordVariables];
}

function createBodyOptions({
  declaredNames,
  evaluationContext,
}: {
  declaredNames: string[];
  evaluationContext: MaterializedEvaluatorContext | null;
}): Completion[] {
  const entriesByName = new Map(
    evaluationContext === null
      ? []
      : [
          ...evaluationContext.evaluatorInputs,
          ...evaluationContext.recordVariables,
        ].map((entry) => [entry.name, entry] as const)
  );
  return declaredNames.map((name, index) => {
    const entry = entriesByName.get(name);
    const preview =
      entry?.status === "resolved" && evaluationContext?.hasSampledRecord
        ? toMemberPreview(entry.value)
        : "";
    return {
      label: name,
      type: "variable",
      ...(preview ? { detail: preview } : {}),
      boost: 100 - index,
    };
  });
}

function createMemberOptions({
  mappingSource,
  language,
  declaredNames,
}: {
  mappingSource: EvaluatorMappingSource;
  language: CodeEvaluatorLanguage;
  declaredNames: string[];
}): Completion[] {
  const declared = new Set(declaredNames);
  return createCompletionOptions({ mappingSource, language }).filter(
    (option) => {
      const root = option.label.split(/[.?]/, 1)[0];
      return root !== undefined && declared.has(root);
    }
  );
}

function toEvaluatorInputCompletion({
  entry,
  evaluationContext,
  index,
}: {
  entry: MaterializedEvaluatorContextEntry;
  evaluationContext: MaterializedEvaluatorContext;
  index: number;
}): Completion {
  return {
    label: entry.name,
    type: entry.status === "unset" ? UNSET_COMPLETION_TYPE : "variable",
    detail: getEvaluatorInputDetail({ entry, evaluationContext }),
    info: getEvaluatorInputInfo({ entry, evaluationContext }),
    section: EVALUATOR_INPUT_SECTION,
    boost: 100 - index,
  };
}

function toRecordVariableCompletion({
  entry,
  evaluationContext,
  index,
}: {
  entry: MaterializedEvaluatorContextEntry;
  evaluationContext: MaterializedEvaluatorContext;
  index: number;
}): Completion {
  const preview =
    entry.status === "resolved" && evaluationContext.hasSampledRecord
      ? toMemberPreview(entry.value)
      : "";
  return {
    label: entry.name,
    type: "variable",
    ...(preview ? { detail: preview } : {}),
    info: getRecordVariableInfo(entry),
    section: RECORD_SECTION_BY_GRAIN[evaluationContext.grain],
    boost: 100 - index,
  };
}

function getEvaluatorInputDetail({
  entry,
  evaluationContext,
}: {
  entry: MaterializedEvaluatorContextEntry;
  evaluationContext: MaterializedEvaluatorContext;
}): string {
  if (entry.status === "unset") {
    return "not set";
  }
  const provenance = entry.provenance;
  const origin =
    provenance.kind === "path"
      ? `← ${provenance.path}`
      : provenance.kind === "derived"
        ? `← ${provenance.description}`
        : provenance.kind === "literal"
          ? "literal"
          : "";
  const preview =
    entry.status === "resolved" && evaluationContext.hasSampledRecord
      ? toMemberPreview(entry.value)
      : "";
  return [origin, preview].filter(Boolean).join(" · ");
}

function getEvaluatorInputInfo({
  entry,
  evaluationContext,
}: {
  entry: MaterializedEvaluatorContextEntry;
  evaluationContext: MaterializedEvaluatorContext;
}): string {
  if (entry.status === "unset") {
    return "Not set. Set in Evaluator input.";
  }
  if (
    entry.name === "input" &&
    entry.provenance.kind === "path" &&
    entry.provenance.path === evaluationContext.grain
  ) {
    return `Whole ${evaluationContext.grain}. Set in Evaluator input.`;
  }
  if (entry.name === "output") {
    const noun = capitalize(evaluationContext.grain);
    return `${noun} output. Set in Evaluator input.`;
  }
  if (entry.name === "metadata") {
    return "Metadata. Set in Evaluator input.";
  }
  return "Set in Evaluator input.";
}

function getRecordVariableInfo(
  entry: MaterializedEvaluatorContextEntry
): string {
  if (entry.name === "latency_ms") {
    return "Span duration, ms. No setup needed.";
  }
  if (entry.name === "duration_ms") {
    return "Session duration, ms. No setup needed.";
  }
  return entry.description ?? "No setup needed.";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Creates the autocompletion extension for the code evaluator editor. */
export function createEvaluatorAutocompletion({
  mappingSource,
  language,
  evaluationContext = null,
}: {
  mappingSource: EvaluatorMappingSource;
  language: CodeEvaluatorLanguage;
  evaluationContext?: MaterializedEvaluatorContext | null;
}) {
  return autocompletion({
    override: [
      createEvaluatorCompletions({
        mappingSource,
        language,
        evaluationContext,
      }),
    ],
    activateOnTyping: true,
    maxRenderedOptions: 50,
    icons: false,
    tooltipClass: () => "dsl-filter-typeahead",
    optionClass: (completion) =>
      completion.type === UNSET_COMPLETION_TYPE
        ? "code-evaluator-completion--unset"
        : "",
  });
}
