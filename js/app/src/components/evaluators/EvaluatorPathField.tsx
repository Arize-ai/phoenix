import type {
  Completion,
  CompletionContext,
  CompletionSource,
} from "@codemirror/autocomplete";
import { css } from "@emotion/react";
import type { EditorView } from "@uiw/react-codemirror";
import { useCallback, useMemo } from "react";

import type { DSLFilterConditionValidationResult } from "@phoenix/components/filter/DSLFilterConditionField";
import { DSLFilterConditionField } from "@phoenix/components/filter/DSLFilterConditionField";
import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorMappingSourceState } from "@phoenix/store/evaluatorStore";
import type { EvaluatorInputMapping } from "@phoenix/types";

import { materializeEvaluatorContext } from "./evaluatorContext";
import { buildEvaluatorContextCandidates } from "./evaluatorContextCompletions";
import type { EvaluatorPathCompletion } from "./evaluatorPathCompletions";
import {
  EVALUATOR_ROOT_PATH_PATTERN,
  getEvaluatorPathCompletions,
  resolveEvaluatorPath,
  SUGGESTED_PATH_SECTION,
} from "./evaluatorPathCompletions";
import type {
  EvaluatorSlotDefault,
  EvaluatorSlotName,
} from "./evaluatorSlotDefaults";
import {
  getEvaluatorSlotDefault,
  getEvaluatorSlotDefaults,
  getEvaluatorSlotSuggestedPaths,
} from "./evaluatorSlotDefaults";

/** What the badge says about a path that names something the record lacks. */
const UNRESOLVED_PATH_MESSAGE = "No such field";

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
  /* The slot's default, standing in for the path the author has not written */
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
 * remembered. Left empty, the field shows the path the slot falls back to.
 */
export function EvaluatorPathField({
  value,
  onChange,
  isInvalid,
  errorMessage,
  ariaLabel,
  evaluatorMappingSource,
  grain,
  slotName,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Set by the form rather than by the path itself. */
  isInvalid: boolean;
  errorMessage?: string;
  ariaLabel: string;
  /** The sampled evaluation context a path is resolved against. */
  evaluatorMappingSource: EvaluatorMappingSourceState;
  grain: ProjectEvaluatorMappingSourceGrain;
  slotName: EvaluatorSlotName;
}) {
  const suggestedPaths = getEvaluatorSlotSuggestedPaths(grain, slotName);
  const slotDefault = getEvaluatorSlotDefault(grain, slotName);

  // CodeMirror is reconfigured whenever these change identity, which discards
  // the open dropdown, so they are memoized rather than left to the compiler.
  const evaluationContext = useMemo(
    () =>
      materializeEvaluatorContext({
        grain,
        evaluatorMappingSource,
        inputMapping: UNMAPPED,
        slotDefaults: getEvaluatorSlotDefaults(grain),
      }),
    [grain, evaluatorMappingSource]
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
            (candidate) => ({
              key: candidate.label,
              path: candidate.label,
              preview: candidate.detail,
              section: candidate.section,
              boost: candidate.boost,
              type: candidate.type,
              description: candidate.info,
            })
          ),
    [evaluationContext]
  );
  const completionSources = useMemo(
    () => [
      createEvaluatorPathCompletionSource({
        source: mappingSource,
        rootCandidates,
        suggestedPaths,
      }),
    ],
    [mappingSource, rootCandidates, suggestedPaths]
  );

  const validatePath = useCallback(
    async (path: string): Promise<DSLFilterConditionValidationResult> => {
      if (isInvalid) {
        return { isValid: false, errorMessage };
      }
      const resolution = resolveEvaluatorPath({ source: mappingSource, path });
      return resolution.status === "unresolved"
        ? { isValid: false, errorMessage: UNRESOLVED_PATH_MESSAGE }
        : { isValid: true };
    },
    [mappingSource, isInvalid, errorMessage]
  );

  const getErrorRange = useCallback(
    (path: string) => {
      const resolution = resolveEvaluatorPath({ source: mappingSource, path });
      return resolution.status === "unresolved" ? resolution.range : null;
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
      placeholder={toGhostText(slotDefault)}
      value={value}
      onChange={onChange}
      completions={NO_COMPLETIONS}
      completionSources={completionSources}
      validateCondition={validatePath}
      getErrorRange={getErrorRange}
      // The field holds the stored path itself, so there is no separate
      // applied value for a settled path to publish.
      onValidCondition={noop}
    />
  );
}

function noop() {}

/** The ghost the field shows while the slot is unmapped. */
function toGhostText(slotDefault: EvaluatorSlotDefault): string {
  return slotDefault.path;
}

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
  suggestedPaths,
}: {
  source: Record<string, unknown>;
  rootCandidates: readonly EvaluatorPathCompletion[];
  suggestedPaths: readonly { path: string; description: string }[];
}): CompletionSource {
  return (context: CompletionContext) => {
    const result = getEvaluatorPathCompletions({
      source,
      rootCandidates,
      suggestedPaths,
      textBeforeCursor: context.state.doc.sliceString(0, context.pos),
    });
    if (result === null) {
      return null;
    }
    return {
      from: result.from,
      options: result.completions.map((completion, index) => ({
        label: completion.key,
        ...(completion.preview ? { detail: completion.preview } : {}),
        // What a row reaches, shown beside the highlighted one — the same slot
        // the filter box's suggestion hints render through.
        info: completion.description,
        type: completion.type ?? "property",
        // Suggestions keep their configured order — the plain narrowing
        // first, the deeper cuts after — instead of sorting alphabetically.
        ...(completion.section === SUGGESTED_PATH_SECTION
          ? { boost: 99 - index }
          : completion.boost != null
            ? { boost: completion.boost }
            : {}),
        section: completion.section,
        apply: (
          view: EditorView,
          _completion: Completion,
          _from: number,
          to: number
        ) => {
          view.dispatch({
            changes: { from: 0, to, insert: completion.path },
            selection: { anchor: completion.path.length },
          });
        },
      })),
      ...(result.containerPath === ""
        ? { validFor: EVALUATOR_ROOT_PATH_PATTERN }
        : {}),
    };
  };
}
