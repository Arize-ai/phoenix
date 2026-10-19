import { css } from "@emotion/react";
import { useEffect, useRef } from "react";

import { Text } from "@phoenix/components";
import { useEvaluatorInputMappingControlsForm } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { EvaluatorPathField } from "@phoenix/components/evaluators/EvaluatorPathField";
import { getEvaluatorInputPlaceholder } from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import { escapeFieldNameForReactHookForm } from "@phoenix/components/evaluators/fieldNameUtils";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import {
  dropOtherRecordKindPathMappings,
  dropPathsShadowedByLiterals,
  type ProjectEvaluatorRecordKind,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * Where the evaluator's declared variables are read from on the record it
 * runs on, one compact row per variable: the name on the left, the path on
 * the right, so the docked panel spends its bounded height on fields rather
 * than on labels. Past {@link TWO_COLUMN_MIN_VARIABLES} the rows flow into a
 * second column where the panel is wide enough, so a long list costs height
 * before it costs the prompt editor.
 *
 * `input`, `output`, and `metadata` read their matching context fields when
 * left blank. Other variables need a path unless they are optional code
 * parameters or already have a saved text binding.
 */
export const ProjectEvaluatorInputMapping = ({
  recordKind,
  requiredVariables,
}: {
  recordKind: ProjectEvaluatorRecordKind;
  /** Every declared variable when omitted, as for a prompt. */
  requiredVariables?: readonly string[];
}) => {
  const variables = useEvaluatorInputVariables();
  const { control, getValues, setValue } = useEvaluatorInputMappingControlsForm(
    {
      pruneEmptyEntries: true,
      // Mounted under a key of the record kind, so switching what the evaluator
      // runs on rebuilds these rows without the previous record kind's paths in
      // them.
      filterInitialMapping: (inputMapping) =>
        dropPathsShadowedByLiterals(
          dropOtherRecordKindPathMappings(inputMapping, recordKind)
        ),
      declaredVariables: variables,
      pathsReplaceLiterals: true,
    }
  );
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  // The form drops a variable's literal once it has a path, and hides a path
  // a literal overrides, so a literal here is what the variable reads.
  const literalMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping.literalMapping
  );
  const rowsRef = useRef<HTMLDivElement>(null);
  const highlightedVariable = useEvaluatorStore(
    (state) => state.highlightedMappingVariable ?? null
  );
  // The test bench asks for a variable's field from the other panel. The
  // dock expands on the same request, so the field may not be laid out yet:
  // it is tried on each frame until it can take focus, then the request is
  // answered.
  const focusRequest = useEvaluatorStore(
    (state) => state.mappingFocusRequest ?? null
  );
  const clearMappingFocusRequest = useEvaluatorStore(
    (state) => state.clearMappingFocusRequest
  );
  useEffect(() => {
    let frame = 0;
    let attempts = 0;
    const tryFocus = (variable: string) => {
      const row = rowsRef.current?.querySelector<HTMLElement>(
        `[data-mapping-variable="${CSS.escape(variable)}"]`
      );
      const field = row?.querySelector<HTMLElement>("[contenteditable]");
      if (row != null && field != null && row.offsetParent != null) {
        row.scrollIntoView({ block: "nearest" });
        field.focus();
        clearMappingFocusRequest();
      } else if (++attempts < MAX_FOCUS_ATTEMPTS) {
        frame = requestAnimationFrame(() => tryFocus(variable));
      } else {
        clearMappingFocusRequest();
      }
    };
    if (focusRequest != null) {
      frame = requestAnimationFrame(() => tryFocus(focusRequest.variable));
    }
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, clearMappingFocusRequest]);
  if (variables.length === 0) {
    return (
      <Text color="text-500" size="S">
        Add variables to the evaluator to map them here.
      </Text>
    );
  }
  return (
    <div
      ref={rowsRef}
      css={mappingRowsCSS}
      data-columns={variables.length >= TWO_COLUMN_MIN_VARIABLES ? "2" : "1"}
    >
      {variables.map((variable) => (
        <div
          key={variable}
          className="mapping-row"
          data-mapping-variable={variable}
          data-highlighted={highlightedVariable === variable || undefined}
        >
          {/* The path field is a CodeMirror editor and takes its accessible
              name from the control itself, so this is a visual label only. */}
          <code className="mapping-row__name" aria-hidden title={variable}>
            {variable}
          </code>
          <div className="mapping-row__field">
            <SwitchableEvaluatorInput
              fieldName={escapeFieldNameForReactHookForm(variable)}
              label={variable}
              hideLabel
              size="S"
              control={control}
              getValues={getValues}
              setValue={setValue}
              pathOptions={[]}
              allowsLiteral={false}
              renderPathInput={({
                value,
                onChange,
                isInvalid,
                errorMessage,
                ariaLabel,
              }) => (
                <EvaluatorPathField
                  value={value}
                  onChange={onChange}
                  isInvalid={isInvalid}
                  errorMessage={errorMessage}
                  ariaLabel={ariaLabel}
                  evaluatorMappingSource={evaluatorMappingSource}
                  recordKind={recordKind}
                  variableName={variable}
                  placeholder={getEvaluatorInputPlaceholder({
                    variableName: variable,
                    isRequired: requiredVariables?.includes(variable) ?? true,
                    literal: Object.hasOwn(literalMapping, variable)
                      ? literalMapping[variable]
                      : undefined,
                  })}
                />
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Frames to wait for a requested field to be laid out before giving up. */
const MAX_FOCUS_ATTEMPTS = 10;

/** From this many variables the rows may take a second column. */
const TWO_COLUMN_MIN_VARIABLES = 5;

const mappingRowsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  width: 100%;
  &[data-columns="2"] {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    column-gap: var(--global-dimension-size-300);
    row-gap: var(--global-dimension-size-100);
  }
  .mapping-row {
    display: grid;
    grid-template-columns: minmax(72px, 160px) minmax(0, 1fr);
    align-items: center;
    gap: var(--global-dimension-size-150);
    border-radius: var(--global-rounding-small);
    // Marked from the test bench while it points at this variable. An
    // outline, so the mark costs the row no layout.
    &[data-highlighted] {
      outline: 2px solid var(--global-color-primary);
      outline-offset: var(--global-dimension-size-50);
    }
  }
  .mapping-row__name {
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    color: var(--global-text-color-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mapping-row__field {
    min-width: 0;
  }
`;
