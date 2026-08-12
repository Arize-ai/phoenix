import {
  Flex,
  SegmentedControl,
  SegmentedControlItem,
  Text,
} from "@phoenix/components";
import {
  isProjectEvaluatorTarget,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export const ProjectEvaluatorTargetField = ({
  value,
  onChange,
  isDisabled = false,
}: {
  value: ProjectEvaluatorTarget;
  onChange: (target: ProjectEvaluatorTarget) => void;
  isDisabled?: boolean;
}) => {
  return (
    <Flex direction="column" gap="size-50" flex="none">
      <Text size="XS" weight="heavy" color="text-700">
        Target
      </Text>
      <SegmentedControl
        aria-label="Evaluator target"
        selectedKey={value}
        onSelectionChange={(key) => {
          if (typeof key === "string" && isProjectEvaluatorTarget(key)) {
            onChange(key);
          }
        }}
      >
        <SegmentedControlItem id="span" isDisabled={isDisabled}>
          Span
        </SegmentedControlItem>
        <SegmentedControlItem id="session" isDisabled>
          Session
        </SegmentedControlItem>
      </SegmentedControl>
    </Flex>
  );
};
