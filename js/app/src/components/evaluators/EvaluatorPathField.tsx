import type {
  Completion,
  CompletionContext,
  CompletionSection,
  CompletionSource,
} from "@codemirror/autocomplete";
import { css } from "@emotion/react";
import type { EditorView } from "@uiw/react-codemirror";
import { useCallback, useMemo } from "react";

import type { DSLFilterConditionValidationResult } from "@phoenix/components/filter/DSLFilterConditionField";
import { DSLFilterConditionField } from "@phoenix/components/filter/DSLFilterConditionField";
import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { classNames } from "@phoenix/utils/classNames";

import type { EvaluatorSlotSuggestedPathLike } from "./evaluatorPathCompletions";
import {
  getEvaluatorPathCompletions,
  resolveEvaluatorPath,
} from "./evaluatorPathCompletions";
import type {
  EvaluatorSlotDefault,
  EvaluatorSlotName,
} from "./evaluatorSlotDefaults";
import {
  getEvaluatorSlotDefault,
  getEvaluatorSlotSuggestedPaths,
} from "./evaluatorSlotDefaults";

/** What the badge says about a path that names something the record lacks. */
const UNRESOLVED_PATH_MESSAGE = "No such field";

const suggestedSection: CompletionSection = { name: "Suggestions", rank: 1 };

const NO_COMPLETIONS: Completion[] = [];
const EMPTY_SOURCE: Record<string, unknown> = {};

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
  /* A default the record derives rather than holds has no path that would
     write it, so it reads as prose — nothing here is typable */
  &.evaluator-path-field--derived-default .cm-placeholder {
    font-family: var(--global-font-family-sans);
    font-style: italic;
  }
`;

/**
 * The path one evaluator input is read from, typed against the record the
 * evaluator runs on.
 *
 * Each `.` opens the next level of the record with the value every field holds
 * on it, so a path is drilled rather than remembered. Left empty, the field
 * shows the path the slot falls back to — the only place that default is
 * written down.
 */
export function EvaluatorPathField({
  value,
  onChange,
  isInvalid,
  errorMessage,
  ariaLabel,
  source,
  grain,
  slotName,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Set by the form rather than by the path itself. */
  isInvalid: boolean;
  errorMessage?: string;
  ariaLabel: string;
  /** The sampled record document a path is resolved against. */
  source: Record<string, unknown> | undefined;
  grain: ProjectEvaluatorMappingSourceGrain;
  slotName: EvaluatorSlotName;
}) {
  const mappingSource = source ?? EMPTY_SOURCE;
  const suggestedPaths = getEvaluatorSlotSuggestedPaths(grain, slotName);
  const slotDefault = getEvaluatorSlotDefault(grain, slotName);

  // CodeMirror is reconfigured whenever these change identity, which discards
  // the open dropdown, so they are memoized rather than left to the compiler.
  const completionSources = useMemo(
    () => [
      createEvaluatorPathCompletionSource({
        source: mappingSource,
        rootToken: grain,
        suggestedPaths,
      }),
    ],
    [mappingSource, grain, suggestedPaths]
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
      className={classNames("evaluator-path-field", "right-child", {
        "evaluator-path-field--derived-default":
          slotDefault?.kind === "derived",
      })}
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

/**
 * The ghost the field shows while the slot is unmapped. A slot with no default
 * shows nothing: there is no value to name, and naming the absence would be
 * one more thing to read on a field that is already empty.
 */
function toGhostText(slotDefault: EvaluatorSlotDefault): string {
  if (slotDefault === null) {
    return "";
  }
  return slotDefault.kind === "path"
    ? slotDefault.path
    : slotDefault.description;
}

/**
 * Offers the members of whichever level of the record the cursor sits in.
 *
 * Accepting a row rewrites the whole path rather than the name under the
 * cursor: a key that dot notation cannot express is written as a subscript, so
 * the separator the user typed is part of what the row replaces.
 */
function createEvaluatorPathCompletionSource({
  source,
  rootToken,
  suggestedPaths,
}: {
  source: Record<string, unknown>;
  rootToken: string;
  suggestedPaths: readonly EvaluatorSlotSuggestedPathLike[];
}): CompletionSource {
  return (context: CompletionContext) => {
    const result = getEvaluatorPathCompletions({
      source,
      rootToken,
      suggestedPaths,
      textBeforeCursor: context.state.doc.sliceString(0, context.pos),
    });
    if (result === null) {
      return null;
    }
    const membersSection: CompletionSection = {
      name: result.containerPath,
      rank: 2,
    };
    return {
      from: result.from,
      options: result.completions.map((completion, index) => ({
        label: completion.key,
        detail: completion.preview,
        // What a suggestion reaches, shown beside the highlighted row — the
        // same slot the filter box's suggestion hints render through.
        info: completion.description,
        type: "property",
        // Suggestions keep their configured order — the plain narrowing
        // first, the deeper cuts after — instead of sorting alphabetically.
        ...(completion.section === "suggested" ? { boost: 99 - index } : {}),
        section:
          completion.section === "suggested"
            ? suggestedSection
            : membersSection,
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
    };
  };
}
