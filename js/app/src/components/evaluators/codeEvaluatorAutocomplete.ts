import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { autocompletion, startCompletion } from "@codemirror/autocomplete";
import type { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@uiw/react-codemirror";

import {
  getCodeEvaluatorMemberCursor,
  toCodeEvaluatorAccessor,
  toCodeEvaluatorPathExpression,
} from "@phoenix/components/evaluators/codeEvaluatorMemberPath";
import type { CodeEvaluatorSignatureNameSlot } from "@phoenix/components/evaluators/codeEvaluatorUtils";
import {
  extractCodeEvaluatorVariablesFromState,
  getCodeEvaluatorCompletionPosition,
  getCodeEvaluatorSignatureNameSlot,
} from "@phoenix/components/evaluators/codeEvaluatorUtils";
import type { MaterializedEvaluatorContext } from "@phoenix/components/evaluators/evaluatorContext";
import {
  buildEvaluatorContextCandidates,
  EVALUATOR_INPUT_SECTION,
  getEvaluatorContextMembers,
  toEvaluatorCompletionClass,
  toMemberDetail,
} from "@phoenix/components/evaluators/evaluatorContextCompletions";
import {
  capBrowsedMembers,
  EVALUATOR_ROOT_PATH_PATTERN,
  reachEvaluatorContainerPath,
  toMemberPreview,
  toMemberSection,
  toWholePathValidFor,
} from "@phoenix/components/evaluators/evaluatorPathCompletions";
import { typeaheadTooltips } from "@phoenix/components/filter/typeaheadTooltip";
import type {
  CodeEvaluatorLanguage,
  EvaluatorMappingSource,
} from "@phoenix/types";
import { flattenObject } from "@phoenix/utils/jsonUtils";

/** The body's drill menu offers nothing beside the level it opened. */
const CODE_MEMBER_SECTION_RANK = 1;

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
      info: "The task's output.",
    },
    ...("reference" in mappingSource
      ? [
          {
            name: "reference",
            data: mappingSource.reference,
            info: "The dataset's reference output.",
          },
        ]
      : []),
    {
      name: "input",
      data: mappingSource.input,
      info: "The task's input.",
    },
    {
      name: "metadata",
      data: mappingSource.metadata,
      info: "Everything else the source carries.",
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
        info: "Reads a dict key, with a default.",
        apply: '.get("key", "")',
        boost: 3,
      },
      {
        label: "isinstance(",
        type: "function",
        info: "Whether a value is an instance of a type.",
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
        info: "A value's type.",
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

    if (position === "signature") {
      return createSignatureResult({
        context,
        mappingSource,
        language,
        evaluationContext,
      });
    }

    const declaredNames = extractCodeEvaluatorVariablesFromState({
      language,
      state: context.state,
    });

    if (evaluationContext !== null) {
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
    const options =
      word.text.includes(".") || word.text.includes("?")
        ? createMemberOptions({ mappingSource, language, declaredNames })
        : createBodyOptions({ declaredNames, evaluationContext, language });

    const typed = word.text.toLowerCase();
    const filteredOptions = typed
      ? options.filter((option) => option.label.toLowerCase().includes(typed))
      : options;
    if (filteredOptions.length === 0) {
      return null;
    }
    if (word.from === word.to && !context.explicit) {
      return null;
    }

    return {
      from: word.from,
      options: filteredOptions,
      // A name row carries the whole path it reaches, so a dot stays inside
      // this result only while it still leads into one of them.
      validFor: toWholePathValidFor({
        pattern: /^[\w.?]*$/,
        labels: filteredOptions.map((option) => option.label),
      }),
    };
  };
}

/**
 * The names the signature can still be given, written into the name slot the
 * cursor sits in.
 *
 * Returns null where the signature is not naming a parameter — a default
 * value, an annotation, or a variadic binds none of the evaluator's inputs.
 */
function createSignatureResult({
  context,
  mappingSource,
  language,
  evaluationContext,
}: {
  context: CompletionContext;
  mappingSource: EvaluatorMappingSource;
  language: CodeEvaluatorLanguage;
  evaluationContext: MaterializedEvaluatorContext | null;
}): CompletionResult | null {
  const slot = getCodeEvaluatorSignatureNameSlot({
    language,
    state: context.state,
    pos: context.pos,
  });
  if (slot === null) {
    return null;
  }
  const slotName = context.state.doc.sliceString(slot.from, slot.to);
  const options = createSignatureOptions({
    mappingSource,
    language,
    evaluationContext,
    // The name being rewritten is not one the signature already spends, or the
    // row that would replace it would be filtered out of its own slot.
    declaredNames: extractCodeEvaluatorVariablesFromState({
      language,
      state: context.state,
    }).filter((name) => name !== slotName),
  }).map((option) => ({
    ...option,
    apply: toSignatureInsertion({
      state: context.state,
      slot,
      name: option.label,
    }),
  }));

  const typed = context.state.doc
    .sliceString(slot.from, context.pos)
    .toLowerCase();
  const filteredOptions = typed
    ? options.filter((option) => option.label.toLowerCase().includes(typed))
    : options;
  return filteredOptions.length === 0
    ? null
    : {
        from: slot.from,
        to: slot.to,
        options: filteredOptions,
        validFor: /^\w*$/,
      };
}

/**
 * A name written into its slot, with whatever separates it from its
 * neighbours.
 *
 * Both languages put a space after a comma and inside a destructure, so a row
 * landing against one supplies the space the author has not typed yet.
 */
function toSignatureInsertion({
  state,
  slot,
  name,
}: {
  state: EditorState;
  slot: CodeEvaluatorSignatureNameSlot;
  name: string;
}): string {
  if (slot.requiresDestructure) {
    return `{ ${name} }`;
  }
  const before = state.doc.sliceString(slot.from - 1, slot.from);
  const after = state.doc.sliceString(slot.to, slot.to + 1);
  const lead = before === "," || before === "{" ? " " : "";
  const trail = after === "}" ? " " : "";
  return `${lead}${name}${trail}`;
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
          option.type === "variable" &&
          !option.label.includes(".") &&
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
  const reached = reachEvaluatorContainerPath({
    source: evaluationContext.values,
    containerPath: cursor.containerPath,
    rootPaths: buildEvaluatorContextCandidates(evaluationContext).map(
      (candidate) => candidate.label
    ),
  });
  const containerPath = reached ?? cursor.containerPath;
  const rootName = containerPath.split(/[.[]/, 1)[0];
  if (rootName === undefined || !declaredNames.includes(rootName)) {
    return null;
  }
  const members = getEvaluatorContextMembers({
    source: evaluationContext.values,
    containerPath,
  });
  if (members.length === 0) {
    return null;
  }

  const section = toMemberSection(containerPath, CODE_MEMBER_SECTION_RANK);
  const expressionFrom = lineStart + cursor.expressionFrom;
  const accessorFrom = lineStart + cursor.accessorFrom;
  // The container the row reads from: what the author wrote, or — when the
  // home they left out had to be filled back in — the expression that reaches
  // it, since the written one names nothing the body can run.
  const container =
    reached === null
      ? context.state.doc.sliceString(expressionFrom, accessorFrom)
      : toCodeEvaluatorPathExpression({
          language,
          source: evaluationContext.values,
          path: reached,
        });
  if (container === null) {
    return null;
  }
  const browsed = capBrowsedMembers({
    members,
    isBrowsing: cursor.partial === "",
  });
  const options: Completion[] = browsed.map((member, index) => {
    const detail = toMemberDetail({ member, evaluationContext });
    const accessor = toCodeEvaluatorAccessor({
      language,
      key: member.key,
      isIndex: member.isIndex,
      isAbsent: member.value == null,
    });
    const expression = `${container}${accessor}`;
    return {
      // A rewritten container replaces the whole expression, so its rows are
      // matched and labelled by the path they reach rather than by a member
      // name the written text does not lead with.
      label: reached === null ? member.key : member.path,
      type: member.isIndex ? "property" : "variable",
      ...(detail ? { detail } : {}),
      info: `inserts ${expression}`,
      section,
      boost: 100 - index,
      apply: (
        view: EditorView,
        _completion: Completion,
        _from: number,
        to: number
      ) => {
        const from = reached === null ? accessorFrom : expressionFrom;
        const insert = reached === null ? accessor : expression;
        const accessorTo = getAccessorEnd({
          state: view.state,
          accessorFrom,
          to,
        });
        view.dispatch({
          changes: { from, to: accessorTo, insert },
          selection: { anchor: from + insert.length },
        });
      },
    };
  });

  return {
    from: reached === null ? lineStart + cursor.from : expressionFrom,
    options,
    validFor: reached === null ? /^\w*$/ : EVALUATOR_ROOT_PATH_PATTERN,
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
}): Extension {
  return [
    typeaheadTooltips(),
    openEmptySignatureMenu(language),
    autocompletion({
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
    }),
  ];
}

/**
 * Opens the menu whenever the cursor lands in a parameter with nothing typed
 * into it yet.
 *
 * An empty `evaluate()` is a question the author has already asked, but
 * CodeMirror only queries the source as characters arrive — so opening the
 * editor, or clicking into the parentheses, would otherwise leave the
 * signature offering nothing until a character is typed.
 */
function openEmptySignatureMenu(language: CodeEvaluatorLanguage): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.view.hasFocus) {
      return;
    }
    if (!update.selectionSet && !update.docChanged && !update.focusChanged) {
      return;
    }
    const cursor = update.state.selection.main;
    if (!cursor.empty) {
      return;
    }
    if (
      !isAtEmptySignatureName({
        language,
        state: update.state,
        pos: cursor.head,
      })
    ) {
      return;
    }
    startCompletion(update.view);
  });
}

/**
 * Whether the cursor sits in a parameter with nothing typed into it.
 *
 * @internal Exported for testing
 */
export function isAtEmptySignatureName({
  language,
  state,
  pos,
}: {
  language: CodeEvaluatorLanguage;
  state: EditorState;
  pos: number;
}): boolean {
  const slot = getCodeEvaluatorSignatureNameSlot({ language, state, pos });
  return slot !== null && slot.from === slot.to;
}
