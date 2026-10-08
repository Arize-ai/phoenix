import type {
  Completion,
  CompletionContext,
  CompletionSource,
} from "@codemirror/autocomplete";
import { acceptCompletion } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { css } from "@emotion/react";
import { useCallback, useMemo, useRef, useState } from "react";

import type { DSLFilterConditionValidationResult } from "@phoenix/components/filter/DSLFilterConditionField";
import { DSLFilterConditionField } from "@phoenix/components/filter/DSLFilterConditionField";
import type { ProjectEvaluatorRecordKind } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorMappingSourceState } from "@phoenix/store/evaluatorStore";
import type { EvaluatorInputMapping } from "@phoenix/types";

import { closeCompletionOnEscape } from "./completionKeys";
import { materializeEvaluatorContext } from "./evaluatorContext";
import { buildEvaluatorContextCandidates } from "./evaluatorContextCompletions";
import type {
  EvaluatorPathCompletion,
  EvaluatorPathIdea,
} from "./evaluatorPathCompletions";
import {
  applyEvaluatorPathCompletion,
  CONTAINER_COMPLETION_TYPE,
  EVALUATOR_ROOT_PATH_PATTERN,
  getEvaluatorPathCompletions,
  hasEvaluatorPathMembers,
  resolveEvaluatorPath,
  toWholePathValidFor,
} from "./evaluatorPathCompletions";
import {
  getEvaluatorPathIdeas,
  MAPPING_PATH_SYNTAX,
} from "./evaluatorPathIdeas";

const UNRESOLVED_PATH_MESSAGE = "No such field";
const INVALID_PATH_MESSAGE = "Not a valid path";

const NO_COMPLETIONS: Completion[] = [];
const EMPTY_SOURCE: Record<string, unknown> = {};

/**
 * A path is written against the context the server builds, not against what
 * the mapping in progress makes of it, so the tree this field completes from
 * is the one every slot still falls back to.
 */
const UNMAPPED: EvaluatorInputMapping = { pathMapping: {}, literalMapping: {} };

const evaluatorPathFieldCSS = css`
  /* The field carries no leading glyph, so the indent its slot would have
     given the text has to come from the editor itself */
  .cm-editor {
    padding-left: var(--global-dimension-size-100);
  }
  .cm-placeholder {
    color: var(--global-text-color-500);
  }
`;

/**
 * The path one evaluator input is read from, typed against the evaluation
 * context the evaluator runs on.
 *
 * The top level is what the evaluator receives — `input`, `output`, `metadata`
 * — with everything the record supplies offered beside them as the
 * `metadata.…` paths that read it, so typing `latency` finds `latency_ms`
 * without knowing where it sits. Each `.` after that opens the next level with
 * the value every field holds on it, so a path is drilled rather than
 * remembered. Left empty, the field shows what the variable reads instead.
 * A path that does not parse is flagged once the field is left.
 */
export function EvaluatorPathField({
  value,
  onChange,
  isInvalid,
  errorMessage,
  ariaLabel,
  evaluatorMappingSource,
  recordKind,
  placeholder,
  onFocusChange,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Set by the form rather than by the path itself. */
  isInvalid: boolean;
  errorMessage?: string;
  ariaLabel: string;
  evaluatorMappingSource: EvaluatorMappingSourceState;
  recordKind: ProjectEvaluatorRecordKind;
  /** What the variable reads while the field is empty. */
  placeholder: string;
  onFocusChange?: (isFocused: boolean) => void;
}) {
  // CodeMirror is reconfigured whenever these change identity, which discards
  // the open dropdown, so they are memoized rather than left to the compiler.
  // This only stops churn; a reconfigure the data genuinely earned is what
  // DSLFilterConditionField re-opens the dropdown after.
  const evaluationContext = useMemo(
    () =>
      materializeEvaluatorContext({
        recordKind,
        evaluatorMappingSource,
        inputMapping: UNMAPPED,
      }),
    [recordKind, evaluatorMappingSource]
  );
  const mappingSource =
    evaluationContext === null
      ? EMPTY_SOURCE
      : (evaluatorMappingSource.source as Record<string, unknown>);
  const rootCandidates = useMemo(
    (): EvaluatorPathCompletion[] =>
      evaluationContext === null
        ? []
        : buildEvaluatorContextCandidates(evaluationContext).map(
            (candidate) => {
              const drills = hasEvaluatorPathMembers(candidate.value);
              return {
                key: candidate.label,
                path: candidate.label,
                detail: candidate.detail,
                section: candidate.section,
                boost: candidate.boost,
                type: drills
                  ? CONTAINER_COMPLETION_TYPE
                  : candidate.type === CONTAINER_COMPLETION_TYPE
                    ? "variable"
                    : candidate.type,
                ...(candidate.info ? { info: candidate.info } : {}),
                drills,
              };
            }
          ),
    [evaluationContext]
  );
  const completionSources = useMemo(
    () => [
      createEvaluatorPathCompletionSource({
        source: mappingSource,
        rootCandidates,
        getIdeas: (containerPath) =>
          getEvaluatorPathIdeas({
            recordKind,
            source: mappingSource,
            containerPath,
            syntax: MAPPING_PATH_SYNTAX,
          }),
      }),
    ],
    [mappingSource, rootCandidates, recordKind]
  );

  // Read through a ref so focusing does not re-run validation; leaving does.
  const isFocusedRef = useRef(false);
  const [blurCount, setBlurCount] = useState(0);
  const handleFocusChange = useCallback(
    (isFocused: boolean) => {
      isFocusedRef.current = isFocused;
      if (!isFocused) {
        setBlurCount((count) => count + 1);
      }
      onFocusChange?.(isFocused);
    },
    [onFocusChange]
  );

  const validatePath = useCallback(
    async (path: string): Promise<DSLFilterConditionValidationResult> => {
      if (isInvalid) {
        return { isValid: false, errorMessage };
      }
      const resolution = resolveEvaluatorPath({ source: mappingSource, path });
      if (resolution.status === "unresolved") {
        return { isValid: false, errorMessage: UNRESOLVED_PATH_MESSAGE };
      }
      if (resolution.status === "invalid" && !isFocusedRef.current) {
        return { isValid: false, errorMessage: INVALID_PATH_MESSAGE };
      }
      return { isValid: true };
    },
    [mappingSource, isInvalid, errorMessage]
  );

  const getErrorRange = useCallback(
    (path: string) => {
      const resolution = resolveEvaluatorPath({ source: mappingSource, path });
      return resolution.status === "unresolved" ||
        resolution.status === "invalid"
        ? resolution.range
        : null;
    },
    [mappingSource]
  );

  return (
    <DSLFilterConditionField
      className="evaluator-path-field"
      css={evaluatorPathFieldCSS}
      aria-label={ariaLabel}
      subjectLabel="path"
      leadingVisual={null}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      completions={NO_COMPLETIONS}
      completionSources={completionSources}
      extensions={pathFieldKeys}
      selectOnOpen
      validateCondition={validatePath}
      validationRetryKey={blurCount}
      onFocusChange={handleFocusChange}
      getErrorRange={getErrorRange}
      // The field holds the stored path itself, so there is no separate
      // applied value for a settled path to publish.
      onValidCondition={noop}
    />
  );
}

function noop() {}

/** Tab accepts the highlighted row; with no menu open it leaves the field. */
const pathFieldKeys = [
  keymap.of([{ key: "Tab", run: acceptCompletion }]),
  closeCompletionOnEscape,
];

/**
 * Offers the level of the evaluation context the cursor sits in.
 *
 * Accepting a row rewrites the whole path rather than the name under the
 * cursor: a row carries a whole path, and a key that dot notation cannot
 * express is written as a subscript, so the separator the user typed is part
 * of what the row replaces.
 */
function createEvaluatorPathCompletionSource({
  source,
  rootCandidates,
  getIdeas,
}: {
  source: Record<string, unknown>;
  rootCandidates: readonly EvaluatorPathCompletion[];
  getIdeas: (containerPath: string) => readonly EvaluatorPathIdea[];
}): CompletionSource {
  return (context: CompletionContext) => {
    const result = getEvaluatorPathCompletions({
      source,
      rootCandidates,
      getIdeas,
      textBeforeCursor: context.state.doc.sliceString(0, context.pos),
      isExplicit: context.explicit,
    });
    if (result === null) {
      return null;
    }
    return {
      from: result.from,
      options: result.completions.map((completion) => ({
        label: completion.key,
        ...(completion.detail ? { detail: completion.detail } : {}),
        ...(completion.info ? { info: completion.info } : {}),
        type: completion.type ?? "property",
        ...(completion.boost != null ? { boost: completion.boost } : {}),
        section: completion.section,
        apply: applyEvaluatorPathCompletion(completion),
      })),
      ...(result.containerPath === ""
        ? {
            // Only the tree's own paths keep the menu open past a dot; an
            // idea's dot leads into a level of its own.
            validFor: toWholePathValidFor({
              pattern: EVALUATOR_ROOT_PATH_PATTERN,
              labels: rootCandidates.map((candidate) => candidate.key),
            }),
          }
        : {}),
    };
  };
}
