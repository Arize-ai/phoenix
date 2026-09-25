import { Flex } from "@phoenix/components";
import { useEvaluatorInputMappingControlsForm } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { EvaluatorPathField } from "@phoenix/components/evaluators/EvaluatorPathField";
import { getEvaluatorMappingRowNames } from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import { escapeFieldNameForReactHookForm } from "@phoenix/components/evaluators/fieldNameUtils";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import {
  dropOtherGrainEntityPathMappings,
  type ProjectEvaluatorMappingSourceGrain,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * Where each evaluator input is read from on the record it runs on: `input`,
 * `output`, and `metadata` first, then every other prompt variable or
 * `evaluate` parameter the evaluator declares.
 *
 * The first three are what the record offers by name, so each reads its own
 * field until pointed elsewhere. Any other variable reads nothing until it is
 * given a path; everything the record holds is reachable under `metadata`.
 */
export const ProjectEvaluatorInputMapping = ({
  grain,
  requiredVariables,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
  /** Every declared variable when omitted, as for a prompt. */
  requiredVariables?: readonly string[];
}) => {
  const variables = getEvaluatorMappingRowNames(useEvaluatorInputVariables());
  const { control, setValue } = useEvaluatorInputMappingControlsForm({
    pruneEmptyEntries: true,
    // Mounted under a key of the grain, so switching what the evaluator runs on
    // rebuilds these rows without the previous record kind's paths in them.
    filterInitialMapping: (inputMapping) =>
      dropOtherGrainEntityPathMappings(inputMapping, grain),
    declaredVariables: variables,
  });
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
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
              grain={grain}
              variableName={variable}
              isRequired={requiredVariables?.includes(variable) ?? true}
            />
          )}
        />
      ))}
    </Flex>
  );
};
