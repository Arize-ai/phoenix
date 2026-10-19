import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { Alert, Button, Icon, Icons, Text, Token } from "@phoenix/components";
import {
  JSONViewBody,
  JSONViewProvider,
  JSONViewToolbar,
} from "@phoenix/components/code";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
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
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
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
 * declares no variables has nothing to check: it is not handed the record's
 * fields on their behalf, so none are listed for it.
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
  return getProjectEvaluatorMappingDiagnostics({
    context,
    pathMapping: inputMapping.pathMapping,
    literalMapping: inputMapping.literalMapping,
    variables: [...declaredVariables],
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

/** One declared variable: where it reads from, and what it read here. */
export type EvaluatorVariableBinding = {
  variable: string;
  status: ProjectEvaluatorMappingDiagnostic["status"];
  /**
   * `default` is a slot reading the record field of its own name, `same-name`
   * an authored variable doing the same, `mapped` a path the author wrote,
   * `text` saved text, and `unmapped` nothing at all.
   */
  sourceKind: "default" | "same-name" | "mapped" | "text" | "unmapped";
  /** The path read on the record; null for text and for nothing. */
  path: string | null;
  /** The value as a run would send it; absent when nothing was read. */
  value?: unknown;
  hasValue: boolean;
  /** What the binding check said, for the shared wording of a failure. */
  diagnostic: ProjectEvaluatorMappingDiagnostic;
};

/**
 * Each declared variable against one record, in declaration order: the
 * diagnostics say whether it binds, the record inputs say to what.
 */
export function getEvaluatorVariableBindings(
  inputs: EvaluatorRecordInputs
): EvaluatorVariableBinding[] {
  const { values, diagnostics } = inputs;
  return diagnostics.map((diagnostic): EvaluatorVariableBinding => {
    const { variable, status, source } = diagnostic;
    const hasValue = Object.hasOwn(values, variable);
    const value = values[variable];
    const shared = { variable, status, value, hasValue, diagnostic };
    if (source === "literal") {
      return { ...shared, sourceKind: "text", path: null };
    }
    if (source === "path") {
      return { ...shared, sourceKind: "mapped", path: diagnostic.path };
    }
    const isUnmapped = status === "missing" || status === "optional-missing";
    return {
      ...shared,
      sourceKind: EVALUATOR_SLOT_NAMES.includes(variable as EvaluatorSlotName)
        ? "default"
        : isUnmapped
          ? "unmapped"
          : "same-name",
      path: isUnmapped ? null : variable,
    };
  });
}

type BindingStatus = {
  label: string;
  icon: ReactNode;
  color: "success" | "danger" | "warning" | "default";
};

function getBindingStatus(
  binding: EvaluatorVariableBinding,
  recordKind: ProjectEvaluatorRecordKind
): BindingStatus {
  if (binding.status === "missing") {
    return {
      label:
        binding.sourceKind === "mapped"
          ? `Not on this ${recordKind}`
          : "Not mapped",
      icon: <Icons.CloseCircle />,
      color: "danger",
    };
  }
  if (binding.status === "optional-missing") {
    return {
      label: "Empty, optional",
      icon: <Icons.AlertCircle />,
      color: "default",
    };
  }
  if (binding.status === "unverified") {
    return {
      label: "Checked at run",
      icon: <Icons.AlertTriangle />,
      color: "warning",
    };
  }
  return {
    label: "Resolved",
    icon: <Icons.CheckmarkCircle />,
    color: "success",
  };
}

const SOURCE_TOKEN: Partial<
  Record<EvaluatorVariableBinding["sourceKind"], string>
> = {
  default: "default",
  "same-name": "same name",
  text: "text",
};

/**
 * The evaluator's inputs for one record, a row per declared variable: the
 * variable and whether it binds, then where it reads from and what it read.
 * A variable that fails the run says why in its own row, and those rows come
 * first so the mapping's to-do is read before what already works. The
 * record's whole context follows, always open, as the span page's attributes
 * table: its keys are the paths a variable can be mapped to.
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
  contextHeading,
}: {
  context: unknown;
  /** The kind of record the row holds; the same word its prose uses. */
  recordKind: ProjectEvaluatorRecordKind;
  inputMapping: EvaluatorInputMapping;
  requiredVariables?: string[];
  isSampleContext: boolean;
  /** The variables section's title. */
  heading?: ReactNode;
  /** The record data section's title, rendered on its toolbar's row. */
  contextHeading?: ReactNode;
}) {
  const declaredVariables = useEvaluatorInputVariables();
  const inputs = getEvaluatorRecordInputs({
    context,
    recordKind,
    inputMapping,
    declaredVariables,
    requiredVariables,
  });
  const bindings = sortFailingFirst(getEvaluatorVariableBindings(inputs));
  const isPromptEvaluator = useEvaluatorStore(
    (state) => state.evaluator.kind === "LLM"
  );
  const readableContext = useMemo(
    () => toReadableContext(context, recordKind),
    [context, recordKind]
  );
  return (
    <div css={inputsViewCSS} data-testid="evaluator-inputs-view">
      <section className="inputs-view__section" aria-label="Variables">
        {heading}
        {isSampleContext ? (
          <Alert variant="info" title={`Standard ${recordKind} fields`}>
            No matching {recordKind} yet; values are empty.
          </Alert>
        ) : null}
        {bindings.length > 0 ? (
          <ul className="inputs-view__list">
            {bindings.map((binding) => (
              <EvaluatorVariableBindingItem
                key={binding.variable}
                binding={binding}
                recordKind={recordKind}
              />
            ))}
          </ul>
        ) : (
          <div className="inputs-view__empty">
            <EmptyState
              graphic={<EmptyStateGraphic variant="genericAdd" />}
              title="No variables"
              description={
                isPromptEvaluator
                  ? `Use a variable in the prompt to pass the evaluator data from this ${recordKind}.`
                  : `Add a parameter to the evaluator's function to pass it data from this ${recordKind}.`
              }
            />
          </div>
        )}
      </section>
      <JSONViewProvider
        value={readableContext}
        defaultMode="table"
        indexNotation="dot"
      >
        <section
          className="inputs-view__section"
          aria-label={`${recordKind} data`}
        >
          <div className="inputs-view__context-header">
            {contextHeading}
            <JSONViewToolbar searchPlaceholder={`Search ${recordKind} data`} />
          </div>
          <div className="inputs-view__table">
            <JSONViewBody
              emptyMessage={`Nothing recorded on this ${recordKind}`}
              noResultsMessage="No matching keys"
            />
          </div>
        </section>
      </JSONViewProvider>
    </div>
  );
}

/** The variables that fail the run first; otherwise declaration order. */
function sortFailingFirst(
  bindings: EvaluatorVariableBinding[]
): EvaluatorVariableBinding[] {
  const fails = (binding: EvaluatorVariableBinding) =>
    binding.status === "missing" ? 0 : 1;
  return [...bindings].sort((a, b) => fails(a) - fails(b));
}

function EvaluatorVariableBindingItem({
  binding,
  recordKind,
}: {
  binding: EvaluatorVariableBinding;
  recordKind: ProjectEvaluatorRecordKind;
}) {
  const status = getBindingStatus(binding, recordKind);
  const isMissing = binding.status === "missing";
  const token = SOURCE_TOKEN[binding.sourceKind];
  return (
    <li className="inputs-view__item" data-status={binding.status}>
      <div className="inputs-view__name">
        <code className="inputs-view__variable">{`{{${binding.variable}}}`}</code>
        <span className="inputs-view__status" data-color={status.color}>
          <Icon svg={status.icon} />
          {status.label}
        </span>
      </div>
      <div className="inputs-view__detail">
        {binding.sourceKind === "unmapped" ? (
          <Text size="XS" color="text-500">
            {`Nothing on the ${recordKind} is named ${binding.variable}`}
          </Text>
        ) : (
          <span className="inputs-view__source">
            {binding.path != null ? (
              <>
                <span>from</span>
                <code>{binding.path}</code>
              </>
            ) : (
              <span>saved text</span>
            )}
            {token ? <Token size="S">{token}</Token> : null}
          </span>
        )}
        {isMissing && binding.sourceKind === "mapped" ? (
          <Text size="XS" color="danger">
            {formatMissingBindingMessage(binding.diagnostic, recordKind)}
          </Text>
        ) : null}
        {binding.status === "unverified" ? (
          <Text size="XS" color="text-500">
            {`${binding.path} is checked when the evaluator runs`}
          </Text>
        ) : null}
        {binding.hasValue ? <BindingValue value={binding.value} /> : null}
      </div>
    </li>
  );
}

/** Past this many characters or lines a value starts folded. */
const FOLDED_VALUE_MAX_CHARACTERS = 280;
const FOLDED_VALUE_MAX_LINES = 4;

/**
 * A variable's value: text as it reads, anything with structure as indented
 * JSON. A long one starts folded to a few lines so one variable cannot push
 * the rest out of the inspector.
 */
function BindingValue({ value }: { value: unknown }) {
  const isText = typeof value === "string";
  const text = isText
    ? value
    : (JSON.stringify(value, null, 2) ?? String(value));
  const isLong =
    text.length > FOLDED_VALUE_MAX_CHARACTERS ||
    text.split("\n").length > FOLDED_VALUE_MAX_LINES;
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="inputs-view__value-wrap">
      <p
        className="inputs-view__value"
        data-format={isText ? "text" : "json"}
        data-folded={isLong && !isExpanded}
      >
        {text}
      </p>
      {isLong ? (
        <Button
          size="S"
          variant="quiet"
          onPress={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Show less" : "Show all"}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The record's context as the mapping reads it: a plain-text input or output
 * the server wrapped as `{ "input": "…" }` shown as its text, since the path
 * that reads that text is the slot's own name, and metadata in reading order.
 */
function toReadableContext(
  context: unknown,
  recordKind: ProjectEvaluatorRecordKind
): unknown {
  if (!isStringKeyedObject(context)) {
    return context;
  }
  const readable: Record<string, unknown> = { ...context };
  for (const slot of LEADING_SLOT_NAMES) {
    if (Object.hasOwn(readable, slot)) {
      readable[slot] = unwrapSingleStringValue(readable[slot]);
    }
  }
  if (Object.hasOwn(readable, EVALUATOR_METADATA_SLOT)) {
    readable[EVALUATOR_METADATA_SLOT] = orderMetadataForReading(
      readable[EVALUATOR_METADATA_SLOT],
      recordKind
    );
  }
  return readable;
}

const inputsViewCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-300);
  min-width: 0;
  .inputs-view__section {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .inputs-view__list {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-small);
  }
  // Framed like the list it stands in for, so the section keeps its shape.
  .inputs-view__empty {
    padding: var(--global-dimension-size-300) var(--global-dimension-size-200);
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-small);
  }
  .inputs-view__item {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) minmax(0, 3fr);
    gap: var(--global-dimension-size-200);
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
    &:not(:last-child) {
      border-bottom: 1px solid var(--global-border-color-default);
    }
    // A variable that fails the run is marked at the edge of its row, so the
    // rows that need the author read apart at a glance.
    &[data-status="missing"] {
      box-shadow: inset 2px 0 0 var(--global-color-danger);
    }
  }
  .inputs-view__name,
  .inputs-view__detail {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }
  .inputs-view__variable,
  .inputs-view__source code {
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-900);
    overflow-wrap: anywhere;
  }
  .inputs-view__variable {
    font-weight: 600;
  }
  .inputs-view__status {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
    &[data-color="success"] {
      color: var(--global-color-success);
    }
    &[data-color="danger"] {
      color: var(--global-color-danger);
    }
    &[data-color="warning"] {
      color: var(--global-color-warning);
    }
  }
  .inputs-view__source {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-75);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }
  .inputs-view__value-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--global-dimension-size-50);
    width: 100%;
    min-width: 0;
  }
  .inputs-view__value {
    margin: 0;
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    color: var(--global-text-color-900);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    &[data-format="json"] {
      font-family: var(--global-font-family-code, monospace);
      font-size: var(--global-font-size-xs);
      line-height: var(--global-line-height-xs);
    }
    &[data-folded="true"] {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: ${FOLDED_VALUE_MAX_LINES};
      overflow: hidden;
    }
  }
  .inputs-view__context-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-200);
    flex-wrap: wrap;
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
