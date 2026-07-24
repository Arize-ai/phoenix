import { useMemo, useState } from "react";
import type {
  MenuTriggerProps,
  SubmenuTriggerProps,
} from "react-aria-components";
import { MenuSection, SubmenuTrigger } from "react-aria-components";
import { graphql, useFragment } from "react-relay";
import { useSearchParams } from "react-router";
import z from "zod";

import type { ButtonProps } from "@phoenix/components/core/button";
import { Button } from "@phoenix/components/core/button";
import { Text } from "@phoenix/components/core/content";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { Flex } from "@phoenix/components/core/layout";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
} from "@phoenix/components/core/menu";
import { CreateBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateBuiltInDatasetEvaluatorSlideover";
import { CreateCodeDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateCodeDatasetEvaluatorSlideover";
import {
  type CreateLLMDatasetEvaluatorInitialState,
  CreateLLMDatasetEvaluatorSlideover,
} from "@phoenix/components/dataset/CreateLLMDatasetEvaluatorSlideover";
import type { AddEvaluatorMenu_codeEvaluatorTemplates$key } from "@phoenix/components/evaluators/__generated__/AddEvaluatorMenu_codeEvaluatorTemplates.graphql";
import type { AddEvaluatorMenu_llmEvaluatorTemplates$key } from "@phoenix/components/evaluators/__generated__/AddEvaluatorMenu_llmEvaluatorTemplates.graphql";
import type { AddEvaluatorMenu_query$key } from "@phoenix/components/evaluators/__generated__/AddEvaluatorMenu_query.graphql";
import {
  CREATE_CODE_EVALUATOR_PARAM,
  CREATE_LLM_EVALUATOR_PARAM,
} from "@phoenix/constants/searchParams";

export const AddEvaluatorMenu = ({
  size,
  datasetId,
  updateConnectionIds,
  query,
  ...props
}: {
  size: ButtonProps["size"];
  datasetId: string;
  updateConnectionIds: string[];
  query: AddEvaluatorMenu_query$key;
} & Omit<MenuTriggerProps, "children">) => {
  const [
    createLLMEvaluatorDialogInitialState,
    setCreateLLMEvaluatorDialogInitialState,
  ] = useState<CreateLLMDatasetEvaluatorInitialState | boolean | null>(null);
  const [builtinEvaluatorIdToAssociate, setBuiltinEvaluatorIdToAssociate] =
    useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldOpenCreateCodeEvaluator =
    searchParams.get(CREATE_CODE_EVALUATOR_PARAM) === "true";
  const shouldOpenCreateLLMEvaluator =
    searchParams.get(CREATE_LLM_EVALUATOR_PARAM) === "true";
  const [isCreateCodeEvaluatorOpen, setIsCreateCodeEvaluatorOpen] =
    useState(false);
  const isCreateCodeEvaluatorSlideoverOpen =
    isCreateCodeEvaluatorOpen || shouldOpenCreateCodeEvaluator;
  const associateBuiltinEvaluatorDialogOpen =
    builtinEvaluatorIdToAssociate != null;
  const onCloseAssociateBuiltinEvaluatorDialog = () => {
    setBuiltinEvaluatorIdToAssociate(null);
  };
  const setCreateCodeEvaluatorOpen = (isOpen: boolean) => {
    setIsCreateCodeEvaluatorOpen(isOpen);
    if (!isOpen && shouldOpenCreateCodeEvaluator) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(CREATE_CODE_EVALUATOR_PARAM);
          return next;
        },
        { replace: true }
      );
    }
  };
  const setCreateLLMEvaluatorOpen = (
    nextState: CreateLLMDatasetEvaluatorInitialState | boolean | null
  ) => {
    setCreateLLMEvaluatorDialogInitialState(nextState);
    if (!nextState && shouldOpenCreateLLMEvaluator) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(CREATE_LLM_EVALUATOR_PARAM);
          return next;
        },
        { replace: true }
      );
    }
  };
  const data = useFragment<AddEvaluatorMenu_query$key>(
    graphql`
      fragment AddEvaluatorMenu_query on Query {
        ...AddEvaluatorMenu_codeEvaluatorTemplates
        ...AddEvaluatorMenu_llmEvaluatorTemplates
      }
    `,
    query
  );
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
          <AddEvaluatorMenuContents
            query={data}
            onCreateEvaluator={() =>
              setCreateLLMEvaluatorDialogInitialState(true)
            }
            onCreateCodeEvaluator={() => setCreateCodeEvaluatorOpen(true)}
            onSelectBuiltInCodeEvaluator={setBuiltinEvaluatorIdToAssociate}
            onSelectBuiltInLLMEvaluator={
              setCreateLLMEvaluatorDialogInitialState
            }
          />
        </MenuContainer>
      </MenuTrigger>
      <CreateLLMDatasetEvaluatorSlideover
        isOpen={
          !!createLLMEvaluatorDialogInitialState || shouldOpenCreateLLMEvaluator
        }
        onOpenChange={setCreateLLMEvaluatorOpen}
        datasetId={datasetId}
        updateConnectionIds={updateConnectionIds}
        initialState={
          createLLMEvaluatorDialogInitialState &&
          typeof createLLMEvaluatorDialogInitialState === "object"
            ? createLLMEvaluatorDialogInitialState
            : undefined
        }
      />

      <CreateBuiltInDatasetEvaluatorSlideover
        isOpen={associateBuiltinEvaluatorDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onCloseAssociateBuiltinEvaluatorDialog();
          }
        }}
        evaluatorId={builtinEvaluatorIdToAssociate}
        datasetId={datasetId}
        updateConnectionIds={updateConnectionIds}
      />
      <CreateCodeDatasetEvaluatorSlideover
        isOpen={isCreateCodeEvaluatorSlideoverOpen}
        onOpenChange={setCreateCodeEvaluatorOpen}
        datasetId={datasetId}
        updateConnectionIds={updateConnectionIds}
      />
    </>
  );
};

export type BuiltInEvaluatorsQueryKey =
  AddEvaluatorMenu_codeEvaluatorTemplates$key &
    AddEvaluatorMenu_llmEvaluatorTemplates$key;

export const AddEvaluatorMenuContents = ({
  query,
  onCreateEvaluator,
  onCreateCodeEvaluator,
  onSelectBuiltInCodeEvaluator,
  onSelectBuiltInLLMEvaluator,
}: {
  query: BuiltInEvaluatorsQueryKey;
  onCreateEvaluator: () => void;
  onCreateCodeEvaluator: () => void;
  onSelectBuiltInCodeEvaluator: (evaluatorId: string) => void;
  onSelectBuiltInLLMEvaluator: (
    initialState: CreateLLMDatasetEvaluatorInitialState | null
  ) => void;
}) => {
  return (
    <Menu
      aria-label="Add evaluator"
      onAction={(action) => {
        switch (action) {
          case "createEvaluator":
            onCreateEvaluator();
            break;
          case "createCodeEvaluator":
            onCreateCodeEvaluator();
            break;
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
        <LLMEvaluatorTemplateSubmenu
          query={query}
          onAction={onSelectBuiltInLLMEvaluator}
        >
          <MenuItem leadingContent={<Icon svg={<Icons.LLMOutput />} />}>
            Use LLM evaluator template
          </MenuItem>
        </LLMEvaluatorTemplateSubmenu>
      </MenuSection>
      <MenuSection>
        <MenuSectionTitle title="New code evaluator" />
        <MenuItem
          leadingContent={<Icon svg={<Icons.Plus />} />}
          id="createCodeEvaluator"
        >
          Create new code evaluator
        </MenuItem>
        <CodeEvaluatorTemplateSubmenu
          query={query}
          onAction={onSelectBuiltInCodeEvaluator}
        >
          <MenuItem leadingContent={<Icon svg={<Icons.Code />} />}>
            Use built-in code evaluator
          </MenuItem>
        </CodeEvaluatorTemplateSubmenu>
      </MenuSection>
    </Menu>
  );
};

type CodeEvaluatorTemplateSubmenuProps = Omit<
  SubmenuTriggerProps,
  "children"
> & {
  children: SubmenuTriggerProps["children"][number];
  query: AddEvaluatorMenu_codeEvaluatorTemplates$key;
  onAction: (evaluatorId: string) => void;
};

const CodeEvaluatorTemplateSubmenu = ({
  children,
  query,
  onAction,
  ...props
}: CodeEvaluatorTemplateSubmenuProps) => {
  const data = useFragment<AddEvaluatorMenu_codeEvaluatorTemplates$key>(
    graphql`
      fragment AddEvaluatorMenu_codeEvaluatorTemplates on Query {
        builtInEvaluators {
          id
          name
          description
          kind
        }
      }
    `,
    query
  );
  const builtInCodeEvaluators = useMemo(
    () =>
      data.builtInEvaluators.filter(
        (evaluator) => evaluator.kind === "BUILTIN"
      ),
    [data.builtInEvaluators]
  );
  return (
    <SubmenuTrigger {...props}>
      {children}
      <MenuContainer
        shouldFlip
        placement="start top"
        minHeight="auto"
        maxWidth={350}
      >
        <Menu
          items={builtInCodeEvaluators}
          onAction={(key) => onAction(String(key))}
        >
          {(evaluator) => (
            <MenuItem
              key={evaluator.id}
              id={evaluator.id}
              textValue={`${evaluator.name}\n${evaluator.description ?? ""}`}
            >
              <Flex direction="column" gap="size-50">
                <Text weight="heavy">{evaluator.name}</Text>
                {evaluator.description && (
                  <Text size="S" color="text-700">
                    {evaluator.description}
                  </Text>
                )}
              </Flex>
            </MenuItem>
          )}
        </Menu>
      </MenuContainer>
    </SubmenuTrigger>
  );
};

type LLMEvaluatorTemplateSubmenuProps = Omit<
  SubmenuTriggerProps,
  "children"
> & {
  children: SubmenuTriggerProps["children"][number];
  query: AddEvaluatorMenu_llmEvaluatorTemplates$key;
  onAction: (
    initialState: CreateLLMDatasetEvaluatorInitialState | null
  ) => void;
};

const LLMEvaluatorTemplateSubmenu = ({
  children,
  query,
  onAction,
  ...props
}: LLMEvaluatorTemplateSubmenuProps) => {
  const data = useFragment<AddEvaluatorMenu_llmEvaluatorTemplates$key>(
    graphql`
      fragment AddEvaluatorMenu_llmEvaluatorTemplates on Query {
        classificationEvaluatorConfigs(labels: ["promoted_dataset_evaluator"]) {
          name
          description
          choices
          optimizationDirection
          messages {
            ...promptUtils_promptMessages
          }
        }
      }
    `,
    query
  );
  const llmEvaluatorTemplates = data.classificationEvaluatorConfigs;
  return (
    <SubmenuTrigger {...props}>
      {children}
      <MenuContainer
        shouldFlip
        placement="start top"
        maxWidth={350}
        minHeight="auto"
      >
        <Menu
          items={llmEvaluatorTemplates}
          onAction={(key) => {
            const evaluator = llmEvaluatorTemplates.find(
              (evaluator) => evaluator.name === key
            );
            if (evaluator) {
              const maybeValidatedChoices = z
                .record(z.string(), z.number())
                .safeParse(evaluator.choices);
              const validatedChoices = maybeValidatedChoices.success
                ? maybeValidatedChoices.data
                : {};
              onAction({
                name: evaluator.name,
                description: evaluator.description ?? "",
                outputConfigs: [
                  {
                    name: evaluator.name,
                    optimizationDirection: evaluator.optimizationDirection,
                    values: Object.entries(validatedChoices).map(
                      ([label, score]) => ({
                        label,
                        score,
                      })
                    ),
                  },
                ],
                promptMessages: evaluator.messages,
              });
            } else {
              onAction(null);
            }
          }}
        >
          {(evaluator) => (
            <MenuItem
              key={evaluator.name}
              id={evaluator.name}
              textValue={`${evaluator.name}\n${evaluator.description ?? ""}`}
            >
              <Flex direction="column" gap="size-50">
                <Text weight="heavy">{evaluator.name}</Text>
                {evaluator.description && (
                  <Text size="S" color="text-700">
                    {evaluator.description}
                  </Text>
                )}
              </Flex>
            </MenuItem>
          )}
        </Menu>
      </MenuContainer>
    </SubmenuTrigger>
  );
};
