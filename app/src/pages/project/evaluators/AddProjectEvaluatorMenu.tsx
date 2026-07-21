import { useState } from "react";
import type { MenuTriggerProps } from "react-aria-components";
import { MenuSection } from "react-aria-components";

import type { ButtonProps } from "@phoenix/components/core/button";
import { Button } from "@phoenix/components/core/button";
import { Icon, Icons } from "@phoenix/components/core/icon";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
} from "@phoenix/components/core/menu";
import { CreateLLMProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/CreateLLMProjectEvaluatorSlideover";

/**
 * Entry point for adding evaluators to a project. Only LLM evaluators are
 * supported for now; code, built-in, and template options will be added as
 * additional menu sections like AddEvaluatorMenu does for datasets.
 */
export const AddProjectEvaluatorMenu = ({
  size,
  projectId,
  updateConnectionIds,
  ...props
}: {
  size: ButtonProps["size"];
  projectId: string;
  updateConnectionIds?: string[];
} & Omit<MenuTriggerProps, "children">) => {
  const [isCreateLLMEvaluatorOpen, setIsCreateLLMEvaluatorOpen] =
    useState(false);
  return (
    <>
      <MenuTrigger {...props}>
        <Button
          variant="primary"
          size={size}
          leadingVisual={<Icon svg={<Icons.Plus />} />}
        >
          Add evaluator
        </Button>
        {/* TODO: Remove minHeight once we have more items in the menu */}
        <MenuContainer minHeight={"auto"}>
          <Menu
            aria-label="Add evaluator"
            onAction={(action) => {
              if (action === "createEvaluator") {
                setIsCreateLLMEvaluatorOpen(true);
              }
            }}
          >
            <MenuSection>
              <MenuSectionTitle title="New LLM evaluator" />
              <MenuItem
                leadingContent={<Icon svg={<Icons.Plus />} />}
                id="createEvaluator"
              >
                Create new LLM evaluator
              </MenuItem>
            </MenuSection>
          </Menu>
        </MenuContainer>
      </MenuTrigger>
      <CreateLLMProjectEvaluatorSlideover
        isOpen={isCreateLLMEvaluatorOpen}
        onOpenChange={setIsCreateLLMEvaluatorOpen}
        projectId={projectId}
        updateConnectionIds={updateConnectionIds}
      />
    </>
  );
};
