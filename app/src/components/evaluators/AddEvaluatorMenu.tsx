import { useMemo, useState } from "react";
import {
  DialogTrigger,
  MenuSection,
  MenuTriggerProps,
  SubmenuTrigger,
  SubmenuTriggerProps,
} from "react-aria-components";
import { graphql, useFragment } from "react-relay";
import z from "zod";

import { Button, ButtonProps } from "@phoenix/components/button";
import { CreateBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateBuiltInDatasetEvaluatorSlideover";
import {
  type CreateLLMDatasetEvaluatorInitialState,
  CreateLLMDatasetEvaluatorSlideover,
} from "@phoenix/components/dataset/CreateLLMDatasetEvaluatorSlideover";
import { AddEvaluatorMenu_codeEvaluatorTemplates$key } from "@phoenix/components/evaluators/__generated__/AddEvaluatorMenu_codeEvaluatorTemplates.graphql";
import type { AddEvaluatorMenu_llmEvaluatorTemplates$key } from "@phoenix/components/evaluators/__generated__/AddEvaluatorMenu_llmEvaluatorTemplates.graphql";
import { AddEvaluatorMenu_query$key } from "@phoenix/components/evaluators/__generated__/AddEvaluatorMenu_query.graphql";
import { Icon, Icons } from "@phoenix/components/icon";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
} from "@phoenix/components/menu";
import { Modal, ModalOverlay } from "@phoenix/components/overlay";

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
  const [createEvaluatorDialogOpen, setCreateEvaluatorDialogOpen] = useState<
    CreateLLMDatasetEvaluatorInitialState | boolean | null
  >(null);
  const [builtinEvaluatorIdToAssociate, setBuiltinEvaluatorIdToAssociate] =
    useState<string | null>(null);
  const associateBuiltinEvaluatorDialogOpen =
    builtinEvaluatorIdToAssociate != null;
  const onCloseAssociateBuiltinEvaluatorDialog = () => {
    setBuiltinEvaluatorIdToAssociate(null);
  };
  const data = useFragment<AddEvaluatorMenu_query$key>(
    graphql`
      fragment AddEvaluatorMenu_query on Query
      @argumentDefinitions(datasetId: { type: "ID!" }) {
        ...AddEvaluatorMenu_codeEvaluatorTemplates
        dataset: node(id: $datasetId) {
          ... on Dataset {
            ...CreateBuiltInDatasetEvaluatorSlideover_dataset
          }
        }
        ...AddEvaluatorMenu_llmEvaluatorTemplates
      }
    `,
    query
  );
  return (
    <>
      <MenuTrigger {...props}>
        <Button
          size={size}
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        >
          Add evaluator
        </Button>
        {/* TODO: Remove minHeight once we have more items in the menu */}
        <MenuContainer minHeight={"auto"}>
          <AddEvaluatorMenuContents
            query={data}
            onCreateEvaluator={() => setCreateEvaluatorDialogOpen(true)}
            onSelectBuiltInCodeEvaluator={setBuiltinEvaluatorIdToAssociate}
            onSelectBuiltInLLMEvaluator={setCreateEvaluatorDialogOpen} // TODO: make this clearer
          />
        </MenuContainer>
      </MenuTrigger>
      <DialogTrigger
        isOpen={!!createEvaluatorDialogOpen}
        onOpenChange={setCreateEvaluatorDialogOpen}
      >
        <CreateLLMDatasetEvaluatorSlideover
          datasetId={datasetId}
          updateConnectionIds={updateConnectionIds}
          initialState={
            createEvaluatorDialogOpen &&
            typeof createEvaluatorDialogOpen === "object"
              ? createEvaluatorDialogOpen
              : undefined
          }
        />
      </DialogTrigger>
      <ModalOverlay
        isOpen={associateBuiltinEvaluatorDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setBuiltinEvaluatorIdToAssociate(null);
          }
        }}
      >
        <Modal size="fullscreen" variant="slideover">
          <CreateBuiltInDatasetEvaluatorSlideover
            evaluatorId={builtinEvaluatorIdToAssociate}
            onClose={onCloseAssociateBuiltinEvaluatorDialog}
            datasetRef={data.dataset}
          />
        </Modal>
      </ModalOverlay>
    </>
  );
};

export type BuiltInEvaluatorsQueryKey =
  AddEvaluatorMenu_codeEvaluatorTemplates$key &
    AddEvaluatorMenu_llmEvaluatorTemplates$key;

export const AddEvaluatorMenuContents = ({
  query,
  onCreateEvaluator,
  onSelectBuiltInCodeEvaluator,
  onSelectBuiltInLLMEvaluator,
}: {
  query: BuiltInEvaluatorsQueryKey;
  onCreateEvaluator: () => void;
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
        }
      }}
    >
      <MenuSection>
        <MenuSectionTitle title="New LLM evaluator" />
        <MenuItem
          leadingContent={<Icon svg={<Icons.PlusOutline />} />}
          id="createEvaluator"
        >
          Create new LLM evaluator
        </MenuItem>
        <LLMEvaluatorTemplateSubmenu
          query={query}
          onAction={onSelectBuiltInLLMEvaluator}
        >
          <MenuItem leadingContent={<Icon svg={<Icons.SquiggleOutline />} />}>
            Use LLM evaluator template
          </MenuItem>
        </LLMEvaluatorTemplateSubmenu>
      </MenuSection>
      <MenuSection>
        <MenuSectionTitle title="New code evaluator" />
        <MenuItem
          leadingContent={<Icon svg={<Icons.PlusOutline />} />}
          isDisabled
          id="createCodeEvaluator"
        >
          Create new code evaluator
        </MenuItem>
        <CodeEvaluatorTemplateSubmenu
          query={query}
          onAction={onSelectBuiltInCodeEvaluator}
        >
          <MenuItem leadingContent={<Icon svg={<Icons.SquiggleOutline />} />}>
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
          kind
        }
      }
    `,
    query
  );
  const builtInCodeEvaluators = useMemo(
    () =>
      data.builtInEvaluators.filter((evaluator) => evaluator.kind === "CODE"),
    [data.builtInEvaluators]
  );
  return (
    <SubmenuTrigger {...props}>
      {children}
      <MenuContainer shouldFlip placement="start top" minHeight="auto">
        <Menu
          items={builtInCodeEvaluators}
          onAction={(key) => onAction(key as string)}
        >
          {(evaluator) => (
            <MenuItem key={evaluator.id} id={evaluator.id}>
              {evaluator.name}
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
        classificationEvaluatorConfigs {
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
      <MenuContainer shouldFlip placement="start top" minHeight="auto">
        <Menu
          items={llmEvaluatorTemplates}
          onAction={(key) => {
            const evaluator = llmEvaluatorTemplates.find(
              (evaluator) => evaluator.name === key
            );
            if (evaluator) {
              const maybeValidatedChoices = z
                .record(z.number())
                .safeParse(evaluator.choices);
              const validatedChoices = maybeValidatedChoices.success
                ? maybeValidatedChoices.data
                : {};
              onAction({
                name: evaluator.name,
                description: evaluator.description ?? "",
                outputConfig: {
                  name: evaluator.name,
                  optimizationDirection: evaluator.optimizationDirection,
                  values: Object.entries(validatedChoices).map(
                    ([label, score]) => ({
                      label,
                      score,
                    })
                  ),
                },
                promptMessages: evaluator.messages,
              });
            } else {
              onAction(null);
            }
          }}
        >
          {(evaluator) => (
            <MenuItem key={evaluator.name} id={evaluator.name}>
              {evaluator.name}
            </MenuItem>
          )}
        </Menu>
      </MenuContainer>
    </SubmenuTrigger>
  );
};
