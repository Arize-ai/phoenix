import { Flex, Text } from "@phoenix/components";
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
 * runs on.
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
  return (
    <Flex direction="column" gap="size-200" width="100%">
      {variables.map((variable) => (
        <SwitchableEvaluatorInput
          key={variable}
          fieldName={escapeFieldNameForReactHookForm(variable)}
          label={variable}
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
      ))}
      {variables.length === 0 && (
        <Text color="text-500">
          Add variables to the evaluator to map them here.
        </Text>
      )}
    </Flex>
  );
};
