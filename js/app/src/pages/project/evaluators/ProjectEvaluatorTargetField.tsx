import {
  Flex,
  Heading,
  Radio,
  RadioGroup,
  Text,
  View,
} from "@phoenix/components";
import {
  isProjectEvaluatorTarget,
  PROJECT_EVALUATOR_TARGETS,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

const TARGET_LABELS: Record<ProjectEvaluatorTarget, string> = {
  span: "Span",
  trace: "Trace",
  session: "Session",
};

/**
 * Picks the artifact type a project evaluator runs against. This section is
 * where project-evaluator settings such as sampling rate, filters, and
 * completion behavior will be added later.
 */
export const ProjectEvaluatorTargetField = ({
  value,
  onChange,
}: {
  value: ProjectEvaluatorTarget;
  onChange: (target: ProjectEvaluatorTarget) => void;
}) => {
  return (
    <View marginBottom="size-200" flex="none">
      <Flex direction="column" gap="size-100">
        <Heading level={2} weight="heavy">
          Target
        </Heading>
        <Text color="text-500">
          Choose what this evaluator runs against as new data arrives.
        </Text>
        <RadioGroup
          value={value}
          aria-label="Evaluator target"
          onChange={(newValue) => {
            if (isProjectEvaluatorTarget(newValue)) {
              onChange(newValue);
            }
          }}
        >
          {PROJECT_EVALUATOR_TARGETS.map((target) => (
            <Radio key={target} value={target}>
              {TARGET_LABELS[target]}
            </Radio>
          ))}
        </RadioGroup>
      </Flex>
    </View>
  );
};
