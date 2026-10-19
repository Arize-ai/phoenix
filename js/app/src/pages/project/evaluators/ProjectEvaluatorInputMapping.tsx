import { css } from "@emotion/react";

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
  const setFocusedMappingVariable = useEvaluatorStore(
    (state) => state.setFocusedMappingVariable
  );
  if (variables.length === 0) {
    return (
      <Text color="text-500" size="S">
        Add variables to the evaluator to map them here.
      </Text>
    );
  }
  return (
    <div
      css={mappingRowsCSS}
      data-columns={variables.length >= TWO_COLUMN_MIN_VARIABLES ? "2" : "1"}
    >
      {variables.map((variable) => (
        <div key={variable} className="mapping-row">
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
                  onFocusChange={(isFocused) =>
                    setFocusedMappingVariable(isFocused ? variable : null)
                  }
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
