import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  Button,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureArrow,
  DisclosureTrigger,
  Icon,
  Icons,
  Input,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
  SearchField,
  SearchIcon,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  Token,
} from "@phoenix/components";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { isEvaluatorSlotName } from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { getEvaluatorRecordInputs } from "@phoenix/pages/project/evaluators/ProjectEvaluatorBindingPreview";
import { requestMapping } from "@phoenix/pages/project/evaluators/projectEvaluatorMappingBridge";
import { unwrapSingleStringValue } from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import type {
  ProjectEvaluatorMappingDiagnostic,
  ProjectEvaluatorRecordKind,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorInputMapping } from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import {
  filterFlatJSONEntries,
  type FlatJSONEntry,
  formatFlatJSONValue,
  toFlatJSONEntries,
} from "@phoenix/utils/jsonUtils";

/**
 * PROTOTYPE: alternative layouts for the inspector's lower half, switched
 * from its header so they can be compared on a live record. "Now" is the
 * shipped layout; the others answer the same three questions (what the
 * prompt declares, where each variable reads from, what that is on this
 * record) in different shapes. Delete the losers once one is picked.
 */
export const INSPECTOR_VARIANTS = [
  { id: "current", label: "Now" },
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
] as const;

export type InspectorVariant = (typeof INSPECTOR_VARIANTS)[number]["id"];

const VARIANT_STORAGE_KEY = "phoenix.projectEvaluatorInspectorVariant";

function readStoredVariant(): InspectorVariant {
  try {
    const stored = window.localStorage.getItem(VARIANT_STORAGE_KEY);
    return INSPECTOR_VARIANTS.some(({ id }) => id === stored)
      ? (stored as InspectorVariant)
      : "a";
  } catch {
    return "a";
  }
}

export function useInspectorVariant() {
  const [variant, setVariant] = useState<InspectorVariant>(readStoredVariant);
  const update = (next: InspectorVariant) => {
    setVariant(next);
    try {
      window.localStorage.setItem(VARIANT_STORAGE_KEY, next);
    } catch {
      // A blocked store only costs the choice surviving a reload.
    }
  };
  return [variant, update] as const;
}

export function InspectorVariantSwitcher({
  variant,
  onChange,
}: {
  variant: InspectorVariant;
  onChange: (variant: InspectorVariant) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label="Inspector layout (prototype)"
      size="S"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[variant]}
      onSelectionChange={(keys) => {
        const [next] = keys;
        const match = INSPECTOR_VARIANTS.find(({ id }) => id === next);
        if (match) onChange(match.id);
      }}
    >
      {INSPECTOR_VARIANTS.map(({ id, label }) => (
        <ToggleButton key={id} id={id}>
          {label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** One declared variable: where it reads from, and what it read here. */
type VariableBinding = {
  variable: string;
  status: ProjectEvaluatorMappingDiagnostic["status"];
  /**
   * `default` is a slot reading the record field of its own name, `same-name`
   * an authored variable doing the same, `mapped` a path the author wrote,
   * `text` a saved literal, and `unmapped` nothing at all.
   */
  sourceKind: "default" | "same-name" | "mapped" | "text" | "unmapped";
  /** The path read on the record; null for text. */
  path: string | null;
  value: unknown;
  hasValue: boolean;
};

function useVariableBindings({
  context,
  recordKind,
  inputMapping,
  requiredVariables,
}: {
  context: unknown;
  recordKind: ProjectEvaluatorRecordKind;
  inputMapping: EvaluatorInputMapping;
  requiredVariables?: string[];
}): VariableBinding[] {
  const declaredVariables = useEvaluatorInputVariables();
  const { values, diagnostics } = getEvaluatorRecordInputs({
    context,
    recordKind,
    inputMapping,
    declaredVariables,
    requiredVariables,
  });
  return diagnostics.map((diagnostic): VariableBinding => {
    const { variable, status, source } = diagnostic;
    const hasValue = Object.hasOwn(values, variable);
    if (source === "literal") {
      return {
        variable,
        status,
        sourceKind: "text",
        path: null,
        value: values[variable],
        hasValue,
      };
    }
    if (source === "path") {
      return {
        variable,
        status,
        sourceKind: "mapped",
        path: diagnostic.path,
        value: values[variable],
        hasValue,
      };
    }
    const isUnmapped = status === "missing" || status === "optional-missing";
    return {
      variable,
      status,
      sourceKind: isEvaluatorSlotName(variable)
        ? "default"
        : isUnmapped
          ? "unmapped"
          : "same-name",
      path: isUnmapped ? null : variable,
      value: values[variable],
      hasValue,
    };
  });
}

/**
 * The record's own data, flattened to the paths a mapping would write. The
 * server wraps a plain-text input or output as `{ "input": "…" }`; shown
 * unwrapped, the row's key is the path that reads the text.
 */
function useSpanDataEntries(context: unknown): FlatJSONEntry[] {
  return useMemo(() => {
    if (!isStringKeyedObject(context)) {
      return [];
    }
    const readable: Record<string, unknown> = { ...context };
    for (const slot of ["input", "output"]) {
      if (Object.hasOwn(readable, slot)) {
        readable[slot] = unwrapSingleStringValue(readable[slot]);
      }
    }
    return toFlatJSONEntries({ value: readable, indexNotation: "bracket" });
  }, [context]);
}

function isReadBy(key: string, binding: VariableBinding): boolean {
  const { path } = binding;
  if (path == null) return false;
  return (
    key === path || key.startsWith(`${path}.`) || key.startsWith(`${path}[`)
  );
}

function formatValue(value: unknown): string {
  return formatFlatJSONValue(unwrapSingleStringValue(value));
}

const STATUS: Record<
  "resolved" | "unmapped" | "not-found" | "optional" | "unverified",
  { label: string; icon: ReactNode; color: string }
> = {
  resolved: {
    label: "Resolved",
    icon: <Icons.CheckmarkCircle />,
    color: "var(--global-color-success)",
  },
  unmapped: {
    label: "Not mapped",
    icon: <Icons.CloseCircle />,
    color: "var(--global-color-danger)",
  },
  "not-found": {
    label: "Not on this span",
    icon: <Icons.CloseCircle />,
    color: "var(--global-color-danger)",
  },
  optional: {
    label: "Empty, optional",
    icon: <Icons.AlertCircle />,
    color: "var(--global-text-color-500)",
  },
  unverified: {
    label: "Checked at run",
    icon: <Icons.AlertTriangle />,
    color: "var(--global-color-warning)",
  },
};

function getStatus(binding: VariableBinding) {
  if (binding.status === "missing") {
    return binding.sourceKind === "mapped"
      ? STATUS["not-found"]
      : STATUS.unmapped;
  }
  if (binding.status === "optional-missing") {
    return STATUS.optional;
  }
  return binding.status === "unverified" ? STATUS.unverified : STATUS.resolved;
}

function isBlocking(binding: VariableBinding) {
  return binding.status === "missing";
}

function StatusLabel({ binding }: { binding: VariableBinding }) {
  const status = getStatus(binding);
  return (
    <span className="variant__status" style={{ color: status.color }}>
      <Icon svg={status.icon} />
      {status.label}
    </span>
  );
}

const SOURCE_TOKEN: Record<VariableBinding["sourceKind"], string | null> = {
  default: "default",
  "same-name": "same name",
  mapped: null,
  text: "text",
  unmapped: null,
};

function SourceLine({
  binding,
  recordKind,
}: {
  binding: VariableBinding;
  recordKind: ProjectEvaluatorRecordKind;
}) {
  const token = SOURCE_TOKEN[binding.sourceKind];
  if (binding.sourceKind === "unmapped") {
    return (
      <Text size="XS" color="text-500">
        Nothing on the {recordKind} is named {binding.variable}
      </Text>
    );
  }
  return (
    <span className="variant__source">
      {binding.path != null ? (
        <>
          <span className="variant__from">from</span>
          <code>{binding.path}</code>
        </>
      ) : (
        <span className="variant__from">saved text</span>
      )}
      {token ? <Token size="S">{token}</Token> : null}
    </span>
  );
}

function MapInFormButton({ variable }: { variable: string }) {
  return (
    <Button
      size="S"
      variant="default"
      leadingVisual={<Icon svg={<Icons.Edit2 />} />}
      onPress={() => requestMapping({ kind: "focus", variable })}
    >
      Map in form
    </Button>
  );
}

type VariantProps = {
  /** The Result section, already laid out by the inspector. */
  result: ReactNode;
  context: unknown;
  recordKind: ProjectEvaluatorRecordKind;
  inputMapping: EvaluatorInputMapping;
  requiredVariables?: string[];
};

export function InspectorVariantBody({
  variant,
  ...props
}: VariantProps & { variant: Exclude<InspectorVariant, "current"> }) {
  const Variant = VARIANT_COMPONENTS[variant];
  return <Variant {...props} />;
}

const VARIANT_COMPONENTS = {
  a: VariantA,
  b: VariantB,
  c: VariantC,
};

/**
 * A: one block per variable, the shape of the case study's mock. The variable
 * and its status on the left; where it reads from and what it read on the
 * right. The record's full data is a disclosure below, for finding a path.
 * The result sits above, full width, so an untested record leaves no column
 * empty.
 */
function VariantA({
  result,
  context,
  recordKind,
  inputMapping,
  requiredVariables,
}: VariantProps) {
  const bindings = useVariableBindings({
    context,
    recordKind,
    inputMapping,
    requiredVariables,
  });
  const entries = useSpanDataEntries(context);
  return (
    <div css={variantCSS} className="variant-a">
      {result}
      <section aria-label="Evaluator inputs" className="variant__section">
        <div className="variant__heading">
          <h3>Evaluator inputs</h3>
          <Text size="XS" color="text-500">
            What each variable receives from this {recordKind}
          </Text>
        </div>
        <ul className="variant-a__list">
          {bindings.map((binding) => (
            <li
              key={binding.variable}
              className="variant-a__item"
              data-blocking={isBlocking(binding) || undefined}
              onMouseEnter={() =>
                requestMapping({ kind: "hover", variable: binding.variable })
              }
              onMouseLeave={() =>
                requestMapping({ kind: "hover", variable: null })
              }
            >
              <div className="variant-a__name">
                <code className="variant__variable">{`{{${binding.variable}}}`}</code>
                <StatusLabel binding={binding} />
              </div>
              <div className="variant-a__detail">
                <SourceLine binding={binding} recordKind={recordKind} />
                {binding.hasValue ? (
                  <p className="variant__value" data-clamp="4">
                    {formatValue(binding.value)}
                  </p>
                ) : isBlocking(binding) ? (
                  <div>
                    <MapInFormButton variable={binding.variable} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <DisclosureGroup className="variant-a__all-data">
        <Disclosure id="all" defaultExpanded={false}>
          <DisclosureTrigger arrowPosition="end">
            All {recordKind} data
            <Token size="S">{entries.length}</Token>
          </DisclosureTrigger>
          <DisclosurePanel>
            <SpanDataTable entries={entries} bindings={bindings} />
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </div>
  );
}

/**
 * B: two tables side by side. The variables on the left, under the result,
 * so the column the result leaves empty before a run holds what the run will
 * send. The record's data on the right, tagged with the variables reading
 * each row. A variable with nothing to read is mapped by picking a row:
 * "Pick" turns the data table into a chooser for that variable.
 */
function VariantB({
  result,
  context,
  recordKind,
  inputMapping,
  requiredVariables,
}: VariantProps) {
  const bindings = useVariableBindings({
    context,
    recordKind,
    inputMapping,
    requiredVariables,
  });
  const entries = useSpanDataEntries(context);
  const [picking, setPicking] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const visibleEntries = filterFlatJSONEntries({ entries, query });
  const hoveredBinding = bindings.find(({ variable }) => variable === hovered);
  return (
    <div css={variantCSS} className="variant-b">
      <div className="variant-b__left">
        {result}
        <section aria-label="Variables" className="variant__section">
          <div className="variant__heading">
            <h3>Variables</h3>
            <Text size="XS" color="text-500">
              What the evaluator receives
            </Text>
          </div>
          <table css={variantTableCSS}>
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Variable</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {bindings.map((binding) => (
                <tr
                  key={binding.variable}
                  data-blocking={isBlocking(binding) || undefined}
                  data-active={
                    picking === binding.variable ||
                    hovered === binding.variable ||
                    undefined
                  }
                  onMouseEnter={() => {
                    setHovered(binding.variable);
                    requestMapping({
                      kind: "hover",
                      variable: binding.variable,
                    });
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                    requestMapping({ kind: "hover", variable: null });
                  }}
                >
                  <td>
                    <div className="variant__cell-stack">
                      <code className="variant__variable">
                        {binding.variable}
                      </code>
                      <SourceLine binding={binding} recordKind={recordKind} />
                    </div>
                  </td>
                  <td>
                    {binding.hasValue ? (
                      <p className="variant__value" data-clamp="3">
                        {formatValue(binding.value)}
                      </p>
                    ) : isBlocking(binding) ? (
                      <div className="variant__cell-stack">
                        <StatusLabel binding={binding} />
                        <Button
                          size="S"
                          variant={
                            picking === binding.variable ? "primary" : "default"
                          }
                          onPress={() =>
                            setPicking(
                              picking === binding.variable
                                ? null
                                : binding.variable
                            )
                          }
                        >
                          {picking === binding.variable
                            ? "Picking…"
                            : "Pick a row"}
                        </Button>
                      </div>
                    ) : (
                      <StatusLabel binding={binding} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <section
        aria-label={`${recordKind} data`}
        className="variant__section variant-b__right"
      >
        <div className="variant__heading variant__heading--toolbar">
          <h3>
            {recordKind === "span"
              ? "Span"
              : recordKind === "trace"
                ? "Trace"
                : "Session"}{" "}
            data
          </h3>
          <SearchField
            aria-label="Search keys and values"
            size="S"
            value={query}
            onChange={setQuery}
          >
            <SearchIcon />
            <Input placeholder="Search keys and values" />
          </SearchField>
        </div>
        {picking != null ? (
          <div className="variant-b__picking" role="status">
            <Text size="S">
              Choose the row <code>{picking}</code> should read
            </Text>
            <Button size="S" variant="quiet" onPress={() => setPicking(null)}>
              Cancel
            </Button>
          </div>
        ) : null}
        <SpanDataTable
          entries={visibleEntries}
          bindings={bindings}
          highlightedBinding={hoveredBinding}
          onPick={
            picking == null
              ? undefined
              : (key) => {
                  requestMapping({
                    kind: "assign",
                    variable: picking,
                    path: key,
                  });
                  setPicking(null);
                }
          }
        />
      </section>
    </div>
  );
}

/**
 * C: one table. The variables lead it, each on the path it reads and the
 * value it read; the rest of the record follows under a divider, each row
 * offering to become a variable's source. The mapping, the prompt's
 * variables, and the record's data are one list read top to bottom.
 */
function VariantC({
  result,
  context,
  recordKind,
  inputMapping,
  requiredVariables,
}: VariantProps) {
  const bindings = useVariableBindings({
    context,
    recordKind,
    inputMapping,
    requiredVariables,
  });
  const entries = useSpanDataEntries(context);
  const hasBlocking = bindings.some(isBlocking);
  const [showOther, setShowOther] = useState(hasBlocking);
  const otherEntries = entries.filter(
    ({ key }) => !bindings.some((binding) => key === binding.path)
  );
  // Variables with nothing to read come first in each row's menu.
  const menuVariables = [...bindings].sort(
    (a, b) => Number(isBlocking(b)) - Number(isBlocking(a))
  );
  return (
    <div css={variantCSS} className="variant-c">
      {result}
      <section aria-label="Evaluator inputs" className="variant__section">
        <div className="variant__heading">
          <h3>Evaluator inputs</h3>
          <Text size="XS" color="text-500">
            Each variable, the path it reads, and its value on this {recordKind}
          </Text>
        </div>
        <table css={variantTableCSS} className="variant-c__table">
          <thead>
            <tr>
              <th style={{ width: "22%" }}>Variable</th>
              <th style={{ width: "30%" }}>Path</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {bindings.map((binding) => (
              <tr
                key={binding.variable}
                data-blocking={isBlocking(binding) || undefined}
                onMouseEnter={() =>
                  requestMapping({ kind: "hover", variable: binding.variable })
                }
                onMouseLeave={() =>
                  requestMapping({ kind: "hover", variable: null })
                }
              >
                <td>
                  <div className="variant__cell-stack">
                    <code className="variant__variable">{`{{${binding.variable}}}`}</code>
                    {binding.status !== "resolved" ? (
                      <StatusLabel binding={binding} />
                    ) : null}
                  </div>
                </td>
                <td>
                  {binding.path != null ? (
                    <span className="variant__source">
                      <code>{binding.path}</code>
                      {SOURCE_TOKEN[binding.sourceKind] ? (
                        <Token size="S">
                          {SOURCE_TOKEN[binding.sourceKind]}
                        </Token>
                      ) : null}
                    </span>
                  ) : binding.sourceKind === "text" ? (
                    <Token size="S">text</Token>
                  ) : (
                    <span className="variant-c__unmapped">
                      <Text size="XS" color="text-500">
                        Map a row below, or
                      </Text>
                      <Button
                        size="S"
                        variant="quiet"
                        onPress={() =>
                          requestMapping({
                            kind: "focus",
                            variable: binding.variable,
                          })
                        }
                      >
                        type a path
                      </Button>
                    </span>
                  )}
                </td>
                <td>
                  {binding.hasValue ? (
                    <p className="variant__value" data-clamp="3">
                      {formatValue(binding.value)}
                    </p>
                  ) : (
                    <Text size="XS" color="text-500">
                      —
                    </Text>
                  )}
                </td>
              </tr>
            ))}
            <tr className="variant-c__divider">
              <td colSpan={3}>
                <button
                  type="button"
                  className="variant-c__divider-button"
                  aria-expanded={showOther}
                  onClick={() => setShowOther(!showOther)}
                >
                  <DisclosureArrow isExpanded={showOther} />
                  Other {recordKind} data
                  <Token size="S">{otherEntries.length}</Token>
                </button>
              </td>
            </tr>
            {showOther
              ? otherEntries.map(({ key, value }) => {
                  const readers = bindings.filter((binding) =>
                    isReadBy(key, binding)
                  );
                  return (
                    <tr key={key} className="variant-c__data-row">
                      <td>
                        {readers.length > 0 ? (
                          <span className="variant__tags">
                            {readers.map(({ variable }) => (
                              <Token key={variable} size="S">
                                {variable}
                              </Token>
                            ))}
                          </span>
                        ) : (
                          <MenuTrigger>
                            <Button
                              size="S"
                              variant="quiet"
                              className="variant-c__map-button"
                              leadingVisual={<Icon svg={<Icons.Link2 />} />}
                            >
                              Map to…
                            </Button>
                            <MenuContainer minHeight="auto">
                              <Menu
                                aria-label={`Map ${key} to a variable`}
                                onAction={(variable) =>
                                  requestMapping({
                                    kind: "assign",
                                    variable: String(variable),
                                    path: key,
                                  })
                                }
                              >
                                {menuVariables.map((binding) => (
                                  <MenuItem
                                    key={binding.variable}
                                    id={binding.variable}
                                  >
                                    {isBlocking(binding)
                                      ? `${binding.variable} (not mapped)`
                                      : binding.variable}
                                  </MenuItem>
                                ))}
                              </Menu>
                            </MenuContainer>
                          </MenuTrigger>
                        )}
                      </td>
                      <td>
                        <code className="variant__key">{key}</code>
                      </td>
                      <td>
                        <p className="variant__value" data-clamp="2">
                          {formatFlatJSONValue(value)}
                        </p>
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/**
 * The record's flattened data. Each row is tagged with the variables that
 * read it; while a variable is being picked for, each row offers itself.
 */
function SpanDataTable({
  entries,
  bindings,
  highlightedBinding,
  onPick,
}: {
  entries: FlatJSONEntry[];
  bindings: VariableBinding[];
  highlightedBinding?: VariableBinding;
  onPick?: (key: string) => void;
}) {
  return (
    <table css={variantTableCSS} data-picking={onPick != null || undefined}>
      <thead>
        <tr>
          <th style={{ width: "38%" }}>Key</th>
          <th>Value</th>
          <th style={{ width: onPick ? 72 : "22%" }}>
            {onPick ? "" : "Read by"}
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map(({ key, value }) => {
          const readers = bindings.filter((binding) => isReadBy(key, binding));
          return (
            <tr
              key={key}
              data-active={
                (highlightedBinding != null &&
                  isReadBy(key, highlightedBinding)) ||
                undefined
              }
            >
              <td>
                <code className="variant__key">{key}</code>
              </td>
              <td>
                <p className="variant__value" data-clamp="2">
                  {formatFlatJSONValue(value)}
                </p>
              </td>
              <td>
                {onPick ? (
                  <Button
                    size="S"
                    variant="primary"
                    onPress={() => onPick(key)}
                  >
                    Use
                  </Button>
                ) : (
                  <span className="variant__tags">
                    {readers.map(({ variable }) => (
                      <Token key={variable} size="S">
                        {variable}
                      </Token>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const variantCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-300);
  min-width: 0;
  .variant__section {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .variant__heading {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    gap: var(--global-dimension-size-100);
    flex-wrap: wrap;
    min-height: var(--global-button-height-s);
    h3 {
      margin: 0;
      font-size: var(--global-font-size-s);
      line-height: var(--global-line-height-s);
      font-weight: 600;
      color: var(--global-text-color-900);
    }
  }
  .variant__heading--toolbar {
    align-items: center;
    justify-content: space-between;
  }
  .variant__variable,
  .variant__key,
  .variant__source code {
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-900);
    overflow-wrap: anywhere;
  }
  .variant__variable {
    font-weight: 600;
  }
  .variant__status {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    font-size: var(--global-font-size-xs);
  }
  .variant__source {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-75);
  }
  .variant__from {
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }
  .variant__value {
    margin: 0;
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    color: var(--global-text-color-900);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
    &[data-clamp="2"] {
      -webkit-line-clamp: 2;
    }
    &[data-clamp="3"] {
      -webkit-line-clamp: 3;
    }
    &[data-clamp="4"] {
      -webkit-line-clamp: 4;
    }
  }
  .variant__cell-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--global-dimension-size-50);
  }
  .variant__tags {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-50);
  }

  // A: one bordered list, a row per variable.
  .variant-a__list {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-small);
  }
  .variant-a__item {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) minmax(0, 3fr);
    gap: var(--global-dimension-size-200);
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
    &:not(:last-child) {
      border-bottom: 1px solid var(--global-border-color-default);
    }
    &:hover {
      background-color: var(--global-color-gray-75);
    }
    &[data-blocking] {
      box-shadow: inset 2px 0 0 var(--global-color-danger);
    }
  }
  .variant-a__name,
  .variant-a__detail {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }
  .variant-a__all-data {
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-small);
    overflow: hidden;
  }

  // B: the result and variables beside the record's data, when there is room.
  &.variant-b {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  @container (min-width: 900px) {
    &.variant-b {
      grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      gap: var(--global-dimension-size-300);
    }
  }
  .variant-b__left {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-300);
    min-width: 0;
  }
  .variant-b__picking {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-75) var(--global-dimension-size-150);
    border-radius: var(--global-rounding-small);
    background-color: var(--global-color-primary-100);
    code {
      font-family: var(--global-font-family-code, monospace);
      font-weight: 600;
    }
  }

  // C: the divider between the variables and the rest of the record.
  .variant-c__divider td {
    padding: 0;
    background-color: var(--global-color-gray-75);
  }
  .variant-c__divider-button {
    all: unset;
    box-sizing: border-box;
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-75) var(--global-dimension-size-150);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    color: var(--global-text-color-700);
    cursor: pointer;
    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: calc(-1 * var(--focus-ring-thickness));
    }
  }
  .variant-c__unmapped {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--global-dimension-size-50);
  }
  // The row's offer to become a source shows where the pointer or focus is.
  .variant-c__data-row .variant-c__map-button {
    opacity: 0;
  }
  .variant-c__data-row:hover .variant-c__map-button,
  .variant-c__data-row .variant-c__map-button[data-focus-visible],
  .variant-c__data-row .variant-c__map-button[aria-expanded="true"] {
    opacity: 1;
  }
`;

const variantTableCSS = css(
  tableCSS,
  borderedTableCSS,
  css`
    table-layout: fixed;
    // Several of these tables share one scrolling body, so a header pinned
    // to its top would float over the table above it.
    thead {
      position: static;
    }
    td {
      vertical-align: top;
    }
    tr[data-blocking] td:first-of-type {
      box-shadow: inset 2px 0 0 var(--global-color-danger);
    }
    tr[data-active] td {
      background-color: var(--global-color-primary-100);
    }
    &[data-picking] tbody tr:hover td {
      background-color: var(--global-color-primary-100);
    }
  `
);
