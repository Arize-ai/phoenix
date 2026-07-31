import {
  Flex,
  Text,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";
import {
  isProjectEvaluatorTarget,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export const ProjectEvaluatorTargetField = ({
  value,
  onChange,
}: {
  value: ProjectEvaluatorTarget;
  onChange: (target: ProjectEvaluatorTarget) => void;
}) => {
  return (
    <Flex direction="column" gap="size-50" flex="none">
      <Text size="XS" weight="heavy" color="text-700">
        Target
      </Text>
      <ToggleButtonGroup
        aria-label="Evaluator target"
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const target = keys.keys().next().value;
          if (typeof target === "string" && isProjectEvaluatorTarget(target)) {
            onChange(target);
          }
        }}
      >
        <ToggleButton id="span" aria-label="Span">
          Span
        </ToggleButton>
        <ToggleButton id="session" aria-label="Session" isDisabled>
          Session
        </ToggleButton>
      </ToggleButtonGroup>
    </Flex>
  );
};
