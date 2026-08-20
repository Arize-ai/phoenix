import { Flex } from "@phoenix/components";
import { EvaluatorPathField } from "@phoenix/components/evaluators/EvaluatorPathField";
import { useEvaluatorInputMappingControlsForm } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EVALUATOR_SLOT_NAMES } from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import {
  dropOtherGrainEntityPathMappings,
  type ProjectEvaluatorMappingSourceGrain,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * Where an evaluator's three inputs are read from on the record it runs on.
 *
 * Every evaluator receives the same three: `input`, `output`, and `metadata`.
 * Leaving one alone keeps the value the record already offers; pointing one at
 * a field of the record reads that field instead. Any field of the record is
 * reachable, so nothing about the record is off limits.
 */
export const ProjectEvaluatorInputMapping = ({
  grain,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
}) => {
  const { control, setValue } = useEvaluatorInputMappingControlsForm({
    pruneEmptyEntries: true,
    // Mounted under a key of the grain, so switching what the evaluator runs on
    // rebuilds these rows without the previous record kind's paths in them.
    filterInitialMapping: (inputMapping) =>
      dropOtherGrainEntityPathMappings(inputMapping, grain),
  });
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  // The store's grain follows the evaluated target; a source built for the
  // other grain has no root this grain's paths could be written against.
  const source =
    evaluatorMappingSource.grain === grain
      ? (evaluatorMappingSource.source as Record<string, unknown>)
      : undefined;
  return (
    <Flex direction="column" gap="size-200" width="100%">
      {EVALUATOR_SLOT_NAMES.map((slotName) => (
        <SwitchableEvaluatorInput
          key={slotName}
          fieldName={slotName}
          label={slotName}
          size="M"
          defaultMode="path"
          control={control}
          setValue={setValue}
          pathOptions={[]}
          literalPlaceholder="Enter a value"
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
              source={source}
              grain={grain}
              slotName={slotName}
            />
          )}
        />
      ))}
    </Flex>
  );
};
