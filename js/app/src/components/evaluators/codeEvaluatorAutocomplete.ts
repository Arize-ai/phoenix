import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@uiw/react-codemirror";

import {
  getCodeEvaluatorMemberCursor,
  toCodeEvaluatorAccessor,
} from "@phoenix/components/evaluators/codeEvaluatorMemberPath";
import {
  extractCodeEvaluatorVariablesFromState,
  getCodeEvaluatorCompletionPosition,
} from "@phoenix/components/evaluators/codeEvaluatorUtils";
import type { MaterializedEvaluatorContext } from "@phoenix/components/evaluators/evaluatorContext";
import {
  buildEvaluatorContextCandidates,
  EVALUATOR_INPUT_SECTION,
  getEvaluatorContextMembers,
  toEvaluatorCompletionClass,
  toMemberDetail,
  toMemberSection,
} from "@phoenix/components/evaluators/evaluatorContextCompletions";
import {
  MAX_BROWSE_MEMBERS,
  toMemberPreview,
} from "@phoenix/components/evaluators/evaluatorPathCompletions";
import type {
  CodeEvaluatorLanguage,
  EvaluatorMappingSource,
} from "@phoenix/types";
import { flattenObject } from "@phoenix/utils/jsonUtils";

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
    {
      name: "metadata",
      data: mappingSource.metadata,
      info: "Additional metadata from the evaluation source",
    },
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

/**
 * Creates a completion function for the code evaluator editor.
 *
 * @internal Exported for testing
 */
export function createEvaluatorCompletions({
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

    const declaredNames = extractCodeEvaluatorVariablesFromState({
      language,
      state: context.state,
    });

    if (position === "body" && evaluationContext !== null) {
      const drill = createMemberDrillResult({
        context,
        language,
        evaluationContext,
        declaredNames,
      });
      if (drill !== null) {
        return drill;
      }
    }

    const word = context.matchBefore(/[\w.?]*/);
    if (!word) {
      return null;
    }
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
      options = createBodyOptions({
        declaredNames,
        evaluationContext,
        language,
      });
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

  // A parameter is a name, so the signature offers only the names the
  // evaluator is handed; everything under them is reached in the body.
  return buildEvaluatorContextCandidates(evaluationContext)
    .filter(
      (candidate) => !candidate.isNested && !declared.has(candidate.label)
    )
    .map((candidate) => ({
      label: candidate.label,
      type: candidate.type,
      ...(candidate.detail ? { detail: candidate.detail } : {}),
      info: candidate.info,
      section: candidate.section,
      boost: candidate.boost,
    }));
}

function createBodyOptions({
  declaredNames,
  evaluationContext,
  language,
}: {
  declaredNames: string[];
  evaluationContext: MaterializedEvaluatorContext | null;
  language: CodeEvaluatorLanguage;
}): Completion[] {
  const candidates =
    evaluationContext === null
      ? []
      : buildEvaluatorContextCandidates(evaluationContext);
  const candidatesByLabel = new Map(
    candidates.map((candidate) => [candidate.label, candidate] as const)
  );
  const parameters: Completion[] = declaredNames.map((name, index) => {
    const candidate = candidatesByLabel.get(name);
    const preview =
      candidate && evaluationContext?.hasSampledRecord
        ? toMemberPreview(candidate.value)
        : "";
    return {
      label: name,
      type: "variable",
      ...(preview ? { detail: preview } : {}),
      boost: 100 - index,
    };
  });
  // A name the record supplies sits one level inside a declared parameter, so
  // the body offers it as the expression that reads it — typing `latency`
  // reaches the value without the author knowing where it lives.
  const declared = new Set(declaredNames);
  const members: Completion[] = candidates
    .filter(
      (candidate) => candidate.isNested && declared.has(candidate.rootName)
    )
    .map((candidate, index) => {
      const accessor = toCodeEvaluatorAccessor({
        language,
        key: candidate.label.slice(candidate.rootName.length + 1),
        isIndex: false,
        isAbsent: candidate.value == null,
      });
      const expression = `${candidate.rootName}${accessor}`;
      return {
        label: candidate.label,
        type: candidate.type,
        ...(candidate.detail ? { detail: candidate.detail } : {}),
        info: `inserts ${expression}`,
        section: candidate.section,
        boost: 50 - index,
        apply: expression,
      };
    });
  return [...parameters, ...members];
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

/**
 * The members of the container the cursor is drilling into, written back in
 * the editor's own language.
 *
 * Returns null when the cursor is not inside a member access on a declared
 * parameter — the body's other positions complete names, not members.
 */
function createMemberDrillResult({
  context,
  language,
  evaluationContext,
  declaredNames,
}: {
  context: CompletionContext;
  language: CodeEvaluatorLanguage;
  evaluationContext: MaterializedEvaluatorContext;
  declaredNames: string[];
}): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const lineStart = line.from;
  const cursor = getCodeEvaluatorMemberCursor(
    context.state.doc.sliceString(lineStart, context.pos)
  );
  if (cursor === null) {
    return null;
  }
  const rootName = cursor.containerPath.split(/[.[]/, 1)[0];
  if (rootName === undefined || !declaredNames.includes(rootName)) {
    return null;
  }
  const members = getEvaluatorContextMembers({
    evaluationContext,
    containerPath: cursor.containerPath,
  });
  if (members.length === 0) {
    return null;
  }

  const section = toMemberSection(cursor.containerPath);
  const accessorFrom = lineStart + cursor.accessorFrom;
  // The container as the author wrote it, so the info card shows the whole
  // expression the row commits to rather than the accessor alone.
  const writtenContainer = context.state.doc.sliceString(
    lineStart + cursor.expressionFrom,
    accessorFrom
  );
  const browsed =
    cursor.partial === "" ? members.slice(0, MAX_BROWSE_MEMBERS) : members;
  const options: Completion[] = browsed.map((member, index) => {
    const detail = toMemberDetail({ member, evaluationContext });
    const accessor = toCodeEvaluatorAccessor({
      language,
      key: member.key,
      isIndex: member.isIndex,
      isAbsent: member.value == null,
    });
    return {
      label: member.key,
      type: member.isIndex ? "property" : "variable",
      ...(detail ? { detail } : {}),
      info: `inserts ${writtenContainer}${accessor}`,
      section,
      boost: 100 - index,
      apply: (
        view: EditorView,
        _completion: Completion,
        _from: number,
        to: number
      ) => {
        const accessorTo = getAccessorEnd({
          state: view.state,
          accessorFrom,
          to,
        });
        view.dispatch({
          changes: { from: accessorFrom, to: accessorTo, insert: accessor },
          selection: { anchor: accessorFrom + accessor.length },
        });
      },
    };
  });

  return {
    from: lineStart + cursor.from,
    options,
    validFor: /^\w*$/,
  };
}

/**
 * Where the accessor being replaced ends.
 *
 * Opening a subscript auto-closes its bracket and quote, so the row has to
 * take those back with it or the rewritten access is left with a stray tail.
 */
function getAccessorEnd({
  state,
  accessorFrom,
  to,
}: {
  state: EditorState;
  accessorFrom: number;
  to: number;
}): number {
  if (state.doc.sliceString(accessorFrom, accessorFrom + 1) !== "[") {
    return to;
  }
  const quote = state.doc.sliceString(accessorFrom + 1, accessorFrom + 2);
  let end = to;
  if (
    (quote === '"' || quote === "'") &&
    state.doc.sliceString(end, end + 1) === quote
  ) {
    end += 1;
  }
  return state.doc.sliceString(end, end + 1) === "]" ? end + 1 : end;
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
    optionClass: toEvaluatorCompletionClass,
  });
}
