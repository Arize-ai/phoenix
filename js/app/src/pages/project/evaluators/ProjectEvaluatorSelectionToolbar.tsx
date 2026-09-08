import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
  Toolbar,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { FloatingToolbarContainer } from "@phoenix/components/core/toolbar/FloatingToolbarContainer";
import { CompareProjectEvaluatorsButton } from "@phoenix/pages/project/evaluators/CompareProjectEvaluatorsButton";
import type { ProjectEvaluatorSelection } from "@phoenix/pages/project/evaluators/projectEvaluatorSelection";

export function ProjectEvaluatorSelectionToolbar({
  selection,
  onClearSelection,
}: {
  selection: ProjectEvaluatorSelection;
  onClearSelection: () => void;
}) {
  const selectedCount = Object.keys(selection).length;
  const isPlural = selectedCount !== 1;

  return (
    <FloatingToolbarContainer>
      <Toolbar aria-label="Evaluator selection">
        <View paddingEnd="size-100">
          <Flex direction="row" gap="size-100" alignItems="center">
            <TooltipTrigger>
              <IconButton
                size="M"
                onPress={onClearSelection}
                aria-label="Clear selection"
              >
                <Icon svg={<Icons.Close />} />
              </IconButton>
              <Tooltip>Clear selection</Tooltip>
            </TooltipTrigger>
            <Text>{`${selectedCount} evaluator${isPlural ? "s" : ""} selected`}</Text>
          </Flex>
        </View>
        <CompareProjectEvaluatorsButton selection={selection} />
      </Toolbar>
    </FloatingToolbarContainer>
  );
}
