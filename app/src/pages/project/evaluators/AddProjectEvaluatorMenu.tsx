import { Suspense, useMemo, useState } from "react";
import type {
  MenuTriggerProps,
  SubmenuTriggerProps,
} from "react-aria-components";
import { MenuSection, SubmenuTrigger } from "react-aria-components";
import { useLazyLoadQuery } from "react-relay";

import type { ButtonProps } from "@phoenix/components/core/button";
import { Button } from "@phoenix/components/core/button";
import { Text } from "@phoenix/components/core/content";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { Flex } from "@phoenix/components/core/layout";
import { Loading } from "@phoenix/components/core/loading";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
} from "@phoenix/components/core/menu";
import { View } from "@phoenix/components/core/view";
import type { projectEvaluatorOptionsQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorOptionsQuery.graphql";
import {
  CreateLLMProjectEvaluatorSlideover,
  type ProjectEvaluatorCreationMode,
} from "@phoenix/pages/project/evaluators/CreateLLMProjectEvaluatorSlideover";
import {
  buildAttachCodeCreationMode,
  buildCopyLlmCreationMode,
  projectEvaluatorOptionsQuery as projectEvaluatorOptionsQueryNode,
} from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";

export const AddProjectEvaluatorMenu = ({
  size,
  projectId,
  updateConnectionIds = [],
  ...props
}: {
  size: ButtonProps["size"];
  projectId: string;
  updateConnectionIds?: string[];
} & Omit<MenuTriggerProps, "children">) => {
  const [creationMode, setCreationMode] =
    useState<ProjectEvaluatorCreationMode | null>(null);
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
        {/* The query lives inside the popover so the evaluator list is only
            fetched when the menu opens, not on every table render. */}
        <MenuContainer minHeight="auto">
          <Suspense fallback={<Loading />}>
            <AddProjectEvaluatorMenuItems
              onSelectCreationMode={setCreationMode}
            />
          </Suspense>
        </MenuContainer>
      </MenuTrigger>
      {creationMode ? (
        <CreateLLMProjectEvaluatorSlideover
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) setCreationMode(null);
          }}
          projectId={projectId}
          creationMode={creationMode}
          updateConnectionIds={updateConnectionIds}
        />
      ) : null}
    </>
  );
};

function AddProjectEvaluatorMenuItems({
  onSelectCreationMode,
}: {
  onSelectCreationMode: (mode: ProjectEvaluatorCreationMode) => void;
}) {
  const data = useLazyLoadQuery<projectEvaluatorOptionsQuery>(
    projectEvaluatorOptionsQueryNode,
    {},
    { fetchPolicy: "store-and-network" }
  );
  const evaluators = useMemo(
    () => data.evaluators.edges.map(({ evaluator }) => evaluator),
    [data.evaluators.edges]
  );
  const llmEvaluators = evaluators.filter(
    (evaluator) => evaluator.__typename === "LLMEvaluator"
  );
  const codeEvaluators = evaluators.filter(
    (evaluator) => evaluator.__typename === "CodeEvaluator"
  );
  const hasMoreEvaluators = data.evaluators.pageInfo.hasNextPage;
  return (
    <>
      <Menu
        aria-label="Add evaluator"
        onAction={(action) => {
          if (action === "createEvaluator") {
            onSelectCreationMode({ kind: "scratch" });
          }
        }}
      >
        <MenuSection>
          <MenuSectionTitle title="LLM evaluator" />
          <MenuItem
            leadingContent={<Icon svg={<Icons.Plus />} />}
            id="createEvaluator"
          >
            Create new LLM evaluator
          </MenuItem>
          <EvaluatorSubmenu
            label="Copy existing LLM evaluator"
            icon={<Icons.LLMOutput />}
            evaluators={llmEvaluators}
            onAction={(evaluatorId) => {
              const evaluator = llmEvaluators.find(
                ({ id }) => id === evaluatorId
              );
              if (!evaluator) return;
              const creationMode = buildCopyLlmCreationMode(evaluator);
              if (creationMode) onSelectCreationMode(creationMode);
            }}
          />
        </MenuSection>
        <MenuSection>
          <MenuSectionTitle title="Code evaluator" />
          <EvaluatorSubmenu
            label="Attach existing code evaluator"
            icon={<Icons.Code />}
            evaluators={codeEvaluators}
            onAction={(evaluatorId) => {
              const evaluator = codeEvaluators.find(
                ({ id }) => id === evaluatorId
              );
              if (!evaluator) return;
              onSelectCreationMode(buildAttachCodeCreationMode(evaluator));
            }}
          />
        </MenuSection>
      </Menu>
      {hasMoreEvaluators ? (
        <View paddingX="size-200" paddingY="size-100">
          <Text size="S" color="text-500">
            Showing the 100 most recently updated evaluators.
          </Text>
        </View>
      ) : null}
    </>
  );
}

function EvaluatorSubmenu({
  label,
  icon,
  evaluators,
  onAction,
}: {
  label: string;
  icon: React.ReactElement;
  evaluators: ReadonlyArray<{
    id: string;
    name: string;
    description: string | null;
  }>;
  onAction: (id: string) => void;
} & Omit<SubmenuTriggerProps, "children">) {
  const hasEvaluators = evaluators.length > 0;
  return (
    <SubmenuTrigger>
      <MenuItem
        leadingContent={<Icon svg={icon} />}
        isDisabled={!hasEvaluators}
      >
        {hasEvaluators ? label : `${label} (none available)`}
      </MenuItem>
      <MenuContainer
        shouldFlip
        placement="start top"
        maxWidth={350}
        minHeight="auto"
      >
        <Menu items={evaluators} onAction={(key) => onAction(String(key))}>
          {(evaluator) => (
            <MenuItem id={evaluator.id} textValue={evaluator.name}>
              <Flex direction="column" gap="size-50">
                <Text weight="heavy">{evaluator.name}</Text>
                {evaluator.description ? (
                  <Text size="S" color="text-700">
                    {evaluator.description}
                  </Text>
                ) : null}
              </Flex>
            </MenuItem>
          )}
        </Menu>
      </MenuContainer>
    </SubmenuTrigger>
  );
}
