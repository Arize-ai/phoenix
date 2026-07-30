import { Suspense, useState } from "react";
import type {
  MenuTriggerProps,
  SubmenuTriggerProps,
} from "react-aria-components";
import { MenuSection, SubmenuTrigger } from "react-aria-components";
import { useLazyLoadQuery, useRelayEnvironment } from "react-relay";
import { useSearchParams } from "react-router";

import { Alert } from "@phoenix/components/core/alert";
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
import {
  CREATE_CODE_EVALUATOR_PARAM,
  CREATE_LLM_EVALUATOR_PARAM,
} from "@phoenix/constants/searchParams";
import type { projectEvaluatorOptionsQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorOptionsQuery.graphql";
import {
  CreateProjectEvaluatorSlideover,
  type ProjectEvaluatorCreationMode,
} from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import {
  buildAttachCodeCreationMode,
  buildCopyLlmCreationMode,
  fetchProjectEvaluatorDetails,
  isCodeProjectEvaluatorDetails,
  isLlmProjectEvaluatorDetails,
  projectEvaluatorOptionsQuery as projectEvaluatorOptionsQueryNode,
  UNSUPPORTED_PROMPT_TEMPLATE_ERROR,
} from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";

export const AddProjectEvaluatorMenu = ({
  size,
  projectId,
  ...props
}: {
  size: ButtonProps["size"];
  projectId: string;
} & Omit<MenuTriggerProps, "children">) => {
  const [creationMode, setCreationMode] =
    useState<ProjectEvaluatorCreationMode | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldOpenScratchFromUrl =
    searchParams.get(CREATE_LLM_EVALUATOR_PARAM) === "true";
  const shouldOpenNewCodeFromUrl =
    searchParams.get(CREATE_CODE_EVALUATOR_PARAM) === "true";
  const activeCreationMode: ProjectEvaluatorCreationMode | null =
    creationMode ??
    (shouldOpenScratchFromUrl
      ? { kind: "scratch" }
      : shouldOpenNewCodeFromUrl
        ? { kind: "newCode" }
        : null);
  const clearCreationMode = () => {
    setCreationMode(null);
    if (shouldOpenScratchFromUrl || shouldOpenNewCodeFromUrl) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(CREATE_LLM_EVALUATOR_PARAM);
          next.delete(CREATE_CODE_EVALUATOR_PARAM);
          return next;
        },
        { replace: true }
      );
    }
  };
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
        {/* Keep the query inside the popover so the evaluator list is fetched
            only when the menu opens. */}
        <MenuContainer minHeight="auto">
          <Suspense fallback={<Loading />}>
            <AddProjectEvaluatorMenuItems
              onSelectCreationMode={(mode) => {
                setSelectionError(null);
                setCreationMode(mode);
              }}
              onSelectionError={setSelectionError}
            />
          </Suspense>
        </MenuContainer>
      </MenuTrigger>
      {selectionError ? (
        <View paddingTop="size-100">
          <Alert variant="danger">{selectionError}</Alert>
        </View>
      ) : null}
      {activeCreationMode ? (
        <CreateProjectEvaluatorSlideover
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) clearCreationMode();
          }}
          projectId={projectId}
          creationMode={activeCreationMode}
        />
      ) : null}
    </>
  );
};

function AddProjectEvaluatorMenuItems({
  onSelectCreationMode,
  onSelectionError,
}: {
  onSelectCreationMode: (mode: ProjectEvaluatorCreationMode) => void;
  onSelectionError: (error: string | null) => void;
}) {
  const environment = useRelayEnvironment();
  const data = useLazyLoadQuery<projectEvaluatorOptionsQuery>(
    projectEvaluatorOptionsQueryNode,
    {},
    { fetchPolicy: "store-and-network" }
  );
  const evaluators = data.evaluators.edges.map(({ evaluator }) => evaluator);
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
          } else if (action === "createCodeEvaluator") {
            onSelectCreationMode({ kind: "newCode" });
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
            onAction={async (evaluatorId) => {
              onSelectionError(null);
              try {
                const evaluator = await fetchProjectEvaluatorDetails({
                  environment,
                  evaluatorId,
                });
                if (!isLlmProjectEvaluatorDetails(evaluator)) {
                  throw new Error("Expected an LLM evaluator");
                }
                const result = buildCopyLlmCreationMode(evaluator);
                if (!result.ok) {
                  onSelectionError(UNSUPPORTED_PROMPT_TEMPLATE_ERROR);
                  return;
                }
                onSelectCreationMode(result.mode);
              } catch {
                onSelectionError(
                  "Unable to load evaluator details. Try again."
                );
              }
            }}
          />
        </MenuSection>
        <MenuSection>
          <MenuSectionTitle title="Code evaluator" />
          <MenuItem
            leadingContent={<Icon svg={<Icons.Plus />} />}
            id="createCodeEvaluator"
          >
            Create new code evaluator
          </MenuItem>
          <EvaluatorSubmenu
            label="Attach existing code evaluator"
            icon={<Icons.Code />}
            evaluators={codeEvaluators}
            onAction={async (evaluatorId) => {
              onSelectionError(null);
              try {
                const evaluator = await fetchProjectEvaluatorDetails({
                  environment,
                  evaluatorId,
                });
                if (!isCodeProjectEvaluatorDetails(evaluator)) {
                  throw new Error("Expected a code evaluator");
                }
                onSelectCreationMode(buildAttachCodeCreationMode(evaluator));
              } catch {
                onSelectionError(
                  "Unable to load evaluator details. Try again."
                );
              }
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
  onAction: (id: string) => void | Promise<void>;
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
