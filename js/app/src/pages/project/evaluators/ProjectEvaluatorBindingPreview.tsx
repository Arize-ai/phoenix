import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useMemo } from "react";

import { Alert, Icon, Icons } from "@phoenix/components";
import {
  JSONViewBody,
  JSONViewProvider,
  JSONViewToolbar,
} from "@phoenix/components/code";
import {
  EVALUATOR_METADATA_SLOT,
  materializeEvaluatorContext,
} from "@phoenix/components/evaluators/evaluatorContext";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { resolveEvaluatorPath } from "@phoenix/components/evaluators/evaluatorPathCompletions";
import {
  EVALUATOR_SLOT_NAMES,
  type EvaluatorSlotName,
} from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { getEvaluatorMetadataEntries } from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import { unwrapSingleStringValue } from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import {
  formatMissingBindingMessage,
  getProjectEvaluatorMappingDiagnostics,
  type ProjectEvaluatorMappingDiagnostic,
  type ProjectEvaluatorRecordKind,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type {
  EvaluatorInputMapping,
  EvaluatorMappingSource,
} from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * What each declared variable resolves to on one record. An evaluator that
 * declares no variables yet is checked against the record's own top-level
 * keys, so the preview has something to show before the prompt does.
 *
 * The one place this is derived: the row's missing count, the inspector's
 * list, and the dock's counter all read it.
 */
export function getRecordMappingDiagnostics({
  context,
  inputMapping,
  declaredVariables,
  requiredVariables,
}: {
  context: unknown;
  inputMapping: EvaluatorInputMapping;
  declaredVariables: readonly string[];
  requiredVariables?: readonly string[];
}): ProjectEvaluatorMappingDiagnostic[] {
  const variables =
    declaredVariables.length === 0 && isStringKeyedObject(context)
      ? Object.keys(context)
      : [...declaredVariables];
  return getProjectEvaluatorMappingDiagnostics({
    context,
    pathMapping: inputMapping.pathMapping,
    literalMapping: inputMapping.literalMapping,
    variables,
    requiredVariables: requiredVariables && [...requiredVariables],
  });
}

/** {@link getRecordMappingDiagnostics} against the variables the form declares. */
export function useEvaluatorMappingDiagnostics({
  context,
  inputMapping,
  requiredVariables,
}: {
  context: unknown;
  inputMapping: EvaluatorInputMapping;
  requiredVariables?: string[];
}): ProjectEvaluatorMappingDiagnostic[] {
  const declaredVariables = useEvaluatorInputVariables();
  return getRecordMappingDiagnostics({
    context,
    inputMapping,
    declaredVariables,
    requiredVariables,
  });
}

/** What one record hands the evaluator, and what in the mapping could not bind. */
export type EvaluatorRecordInputs = {
  /**
   * The value under each variable name, in reading order: `input` and
   * `output`, the authored variables, then `metadata`, which fans out into
   * the most rows and so goes last.
   */
  values: Record<string, unknown>;
  diagnostics: ProjectEvaluatorMappingDiagnostic[];
};

const LEADING_SLOT_NAMES: readonly EvaluatorSlotName[] = ["input", "output"];

/**
 * A variable with something to say where its value would be: an error when
 * the path names nothing on this record, a warning when nothing here can say.
 */
type InputDiagnosticMessage = {
  variant: "error" | "warning";
  variable: string;
  message: string;
};

/**
 * Resolves the evaluator's inputs against one record the way a run would:
 * the slot fallbacks, the `metadata` key, and the path resolver all come from
 * the shared materialization rather than being re-derived here.
 */
export function getEvaluatorRecordInputs({
  context,
  recordKind,
  inputMapping,
  declaredVariables,
  requiredVariables,
}: {
  context: unknown;
  recordKind: ProjectEvaluatorRecordKind;
  inputMapping: EvaluatorInputMapping;
  declaredVariables: readonly string[];
  requiredVariables?: readonly string[];
}): EvaluatorRecordInputs {
  const diagnostics = getRecordMappingDiagnostics({
    context,
    inputMapping,
    declaredVariables,
    requiredVariables,
  });
  const evaluationContext = hasEvaluatorMappingSourceShape(context)
    ? materializeEvaluatorContext({
        recordKind,
        evaluatorMappingSource: { recordKind, source: context },
        inputMapping,
      })
    : null;
  const slotValues = evaluationContext?.values ?? {};
  const source = isStringKeyedObject(context) ? context : {};
  const values: Record<string, unknown> = {};
  // The server wraps a plain-string input or output as `{ "input": "…" }`;
  // a row named `input.input` would send the author after a key that is
  // not theirs to map, so the two slots read as the text they hold.
  for (const slot of LEADING_SLOT_NAMES) {
    if (Object.hasOwn(slotValues, slot)) {
      values[slot] = unwrapSingleStringValue(slotValues[slot]);
    }
  }
  for (const diagnostic of diagnostics) {
    if (
      EVALUATOR_SLOT_NAMES.includes(diagnostic.variable as EvaluatorSlotName) ||
      diagnostic.status !== "resolved"
    ) {
      continue;
    }
    if (diagnostic.source === "literal") {
      values[diagnostic.variable] =
        inputMapping.literalMapping[diagnostic.variable];
    } else if (diagnostic.source === "context") {
      values[diagnostic.variable] = source[diagnostic.variable];
    } else {
      const resolution = resolveEvaluatorPath({
        source,
        path: diagnostic.path,
      });
      const resolved =
        resolution.status === "resolved" ? resolution.value : undefined;
      values[diagnostic.variable] = LEADING_SLOT_NAMES.includes(
        diagnostic.path as EvaluatorSlotName
      )
        ? unwrapSingleStringValue(resolved)
        : resolved;
    }
  }
  if (Object.hasOwn(slotValues, EVALUATOR_METADATA_SLOT)) {
    values[EVALUATOR_METADATA_SLOT] = orderMetadataForReading(
      slotValues[EVALUATOR_METADATA_SLOT],
      recordKind
    );
  }
  return { values, diagnostics };
}

/**
 * The evaluator's inputs for one record, as the same searchable key/value
 * table the span page uses for attributes. Every row's key is the path that
 * reads it, so a key copied from here can be pasted into the mapping on the
 * left. A variable the mapping cannot bind is listed above the table rather
 * than as a row, since there is no value to put in one.
 *
 * @internal Exported for testing
 */
export function EvaluatorInputsView({
  context,
  recordKind,
  inputMapping,
  requiredVariables,
  isSampleContext,
  heading,
}: {
  context: unknown;
  /** The kind of record the row holds; the same word its prose uses. */
  recordKind: ProjectEvaluatorRecordKind;
  inputMapping: EvaluatorInputMapping;
  requiredVariables?: string[];
  isSampleContext: boolean;
  /** The section title, rendered on the toolbar's row. */
  heading?: ReactNode;
}) {
  const declaredVariables = useEvaluatorInputVariables();
  const { values, diagnostics } = getEvaluatorRecordInputs({
    context,
    recordKind,
    inputMapping,
    declaredVariables,
    requiredVariables,
  });
  const messages: InputDiagnosticMessage[] = diagnostics.flatMap(
    (diagnostic): InputDiagnosticMessage[] => {
      if (diagnostic.status === "missing") {
        return [
          {
            variant: "error",
            variable: diagnostic.variable,
            message: formatMissingBindingMessage(diagnostic, recordKind),
          },
        ];
      }
      if (diagnostic.status === "unverified") {
        return [
          {
            variant: "warning",
            variable: diagnostic.variable,
            // Only paths reach `unverified`, so this is always a real
            // authored path rather than a bare variable name.
            message: `${diagnostic.path} is checked when the evaluator runs`,
          },
        ];
      }
      return [];
    }
  );
  return (
    <JSONViewProvider value={values} defaultMode="table" indexNotation="dot">
      <div css={inputsViewCSS} data-testid="evaluator-inputs-view">
        <div className="inputs-view__header">
          {heading}
          <JSONViewToolbar searchPlaceholder="Search inputs" />
        </div>
        {isSampleContext ? (
          <Alert variant="info" title={`Standard ${recordKind} fields`}>
            No matching {recordKind} yet; values are empty.
          </Alert>
        ) : null}
        {messages.length > 0 ? (
          <ul className="inputs-view__diagnostics">
            {messages.map(({ variant, variable, message }) => (
              <li
                key={variable}
                className="inputs-view__diagnostic"
                data-variant={variant}
              >
                <Icon
                  svg={
                    variant === "error" ? (
                      <Icons.CloseCircle />
                    ) : (
                      <Icons.AlertTriangle />
                    )
                  }
                  color={variant === "error" ? "danger" : "warning"}
                  aria-label={variant}
                />
                <code>{variable}</code>
                <span>{message}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="inputs-view__table">
          <JSONViewBody
            emptyMessage={`Nothing on this ${recordKind} is bound`}
            noResultsMessage="No matching inputs"
          />
        </div>
      </div>
    </JSONViewProvider>
  );
}

const inputsViewCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  .inputs-view__header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-200);
    flex-wrap: wrap;
  }
  .inputs-view__diagnostics {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-50);
  }
  .inputs-view__diagnostic {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-100);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    code {
      font-family: var(--global-font-family-code, monospace);
      font-weight: 600;
      color: var(--global-text-color-900);
    }
    &[data-variant="error"] span {
      color: var(--global-color-danger);
    }
    &[data-variant="warning"] span {
      color: var(--global-color-warning);
    }
  }
  .inputs-view__table {
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-small);
    overflow: hidden;
    min-width: 0;
  }
`;

/**
 * The server hands `metadata` back with its ids first. A prompt author reads
 * for attributes and status, so the table lists keys in the order the mapping
 * vocabulary names them, with whatever the vocabulary does not name kept
 * after them.
 */
function orderMetadataForReading(
  value: unknown,
  recordKind: ProjectEvaluatorRecordKind
): unknown {
  if (!isStringKeyedObject(value)) {
    return value;
  }
  const ordered: Record<string, unknown> = {};
  for (const { name } of getEvaluatorMetadataEntries(recordKind)) {
    if (Object.hasOwn(value, name)) {
      ordered[name] = value[name];
    }
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!Object.hasOwn(ordered, key)) {
      ordered[key] = entry;
    }
  }
  return ordered;
}

/**
 * Binds the mapping source to the open row's context, so the input mapping is
 * authored and diagnosed against the value a Run would actually send.
 *
 * The row object is rebuilt every render, and a session keeps its key while its
 * context changes under it — a refresh, a preview-window change, or a load-more
 * can all return a new transcript for the same row. Keying on what the context
 * says rather than on the row's identity follows the value, not the row.
 *
 * The record kind comes from the list the row renders in and is bound with the
 * context, so a target switch that remounts a cached list binds a record the
 * store reads as what it is, whichever of this and the target's record kind
 * effect runs first.
 */
export function useEvaluatorMappingSourceBoundToRow({
  recordKind,
  rowKey,
  context,
}: {
  recordKind: ProjectEvaluatorRecordKind;
  rowKey: string | null;
  context: unknown;
}) {
  const evaluatorStore = useEvaluatorStoreInstance();
  const contextIdentity = useMemo(
    () => (context == null ? null : JSON.stringify(context)),
    [context]
  );
  const syncMappingSource = useEffectEvent(() => {
    if (hasEvaluatorMappingSourceShape(context)) {
      evaluatorStore
        .getState()
        .setEvaluatorMappingSource({ recordKind, source: context });
    }
  });
  useEffect(() => {
    syncMappingSource();
  }, [recordKind, rowKey, contextIdentity]);
}

export function hasEvaluatorMappingSourceShape(
  value: unknown
): value is EvaluatorMappingSource<ProjectEvaluatorRecordKind> {
  return isStringKeyedObject(value) && isStringKeyedObject(value.metadata);
}
