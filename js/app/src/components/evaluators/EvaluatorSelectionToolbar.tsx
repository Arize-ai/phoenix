import type { ReactNode } from "react";

import {
  Button,
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

/**
 * The floating toolbar shown while evaluators are selected in a table: the
 * selected count, a button to clear the selection, any extra actions, and a
 * delete button.
 */
export function EvaluatorSelectionToolbar({
  selectedCount,
  onClearSelection,
  onDelete,
  children,
}: {
  selectedCount: number;
  onClearSelection: () => void;
  /** Opens the confirmation for deleting the selected evaluators. */
  onDelete: () => void;
  /** Actions shown before the delete button. */
  children?: ReactNode;
}) {
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
        {children}
        <Button
          variant="danger"
          size="M"
          leadingVisual={<Icon svg={<Icons.Trash />} />}
          onPress={onDelete}
        >
          Delete
        </Button>
      </Toolbar>
    </FloatingToolbarContainer>
  );
}
