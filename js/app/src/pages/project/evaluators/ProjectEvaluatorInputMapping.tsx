import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { EvaluatorInputDescriptionEditor } from "@phoenix/components/evaluators/EvaluatorInputDescriptionEditor";
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
 * runs on, one full-width row per variable: the name above the path field,
 * and under the field what the variable should hold, when the author has
 * described it. A "describe" link at the end of the name row edits that text
 * in a popover, so the rows stay as tall as their fields.
 *
 * `input`, `output`, and `metadata` read their matching context fields when
 * left blank. Other variables need a path unless they are optional code
 * parameters or already have a saved text binding.
 */
export const ProjectEvaluatorInputMapping = ({
  recordKind,
  requiredVariables,
  emptyState,
  canDescribeInputs = true,
}: {
  recordKind: ProjectEvaluatorRecordKind;
  /**
   * Shown in place of the rows when the evaluator declares no variables.
   * The controls form hook above the early return still runs then, and it
   * is what drops a removed variable's mapping from the store, so the
   * return has to stay below it.
   */
  emptyState?: ReactNode;
  /** Every declared variable when omitted, as for a prompt. */
  requiredVariables?: readonly string[];
  /**
   * Whether the form saves the evaluator's definition, so a description
   * written here persists. A form that only binds an existing evaluator
   * shows its descriptions without the link to edit them.
   */
  canDescribeInputs?: boolean;
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
  const inputDescriptions = useEvaluatorStore(
    (state) => state.evaluator.inputDescriptions
  );
  const setInputDescription = useEvaluatorStore(
    (state) => state.setInputDescription
  );
  const setFocusedMappingVariable = useEvaluatorStore(
    (state) => state.setFocusedMappingVariable
  );
  if (variables.length === 0) {
    return emptyState ?? null;
  }
  return (
    <div css={mappingRowsCSS}>
      {variables.map((variable) => {
        const description = inputDescriptions[variable] ?? "";
        return (
          <SwitchableEvaluatorInput
            key={variable}
            fieldName={escapeFieldNameForReactHookForm(variable)}
            label={variable}
            labelExtra={
              canDescribeInputs ? (
                <EvaluatorInputDescriptionEditor
                  inputName={variable}
                  description={description}
                  onSave={(text) => setInputDescription(variable, text)}
                />
              ) : undefined
            }
            description={description || undefined}
            size="M"
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
        );
      })}
    </div>
  );
};

const mappingRowsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  width: 100%;
`;
