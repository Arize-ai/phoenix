import { Flex } from "@phoenix/components";
import { useEvaluatorInputMappingControlsForm } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorPathField } from "@phoenix/components/evaluators/EvaluatorPathField";
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
 * Leaving one alone keeps the value the context already offers under that name;
 * pointing one at a path reads that instead. Everything the record holds is
 * reachable under `metadata`, so nothing about it is off limits.
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
  return (
    <Flex direction="column" gap="size-200" width="100%">
      {EVALUATOR_SLOT_NAMES.map((slotName) => (
        <SwitchableEvaluatorInput
          key={slotName}
          fieldName={slotName}
          label={slotName}
          size="M"
          control={control}
          setValue={setValue}
          pathOptions={[]}
          // A project evaluator's mapping is stored on the evaluator, not on
          // the record, so a pinned constant would travel with it; every input
          // is authored as a path.
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
              slotName={slotName}
            />
          )}
        />
      ))}
    </Flex>
  );
};
