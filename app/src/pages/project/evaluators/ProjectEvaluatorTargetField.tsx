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
            <Radio key={target} value={target} isDisabled={target !== "span"}>
              {TARGET_LABELS[target]}
              {target !== "span" ? " (coming soon)" : ""}
            </Radio>
          ))}
        </RadioGroup>
      </Flex>
    </View>
  );
};
