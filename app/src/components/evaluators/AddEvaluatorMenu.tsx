import { useMemo, useState } from "react";
import {
  DialogTrigger,
  MenuSection,
  MenuTriggerProps,
  SubmenuTrigger,
  SubmenuTriggerProps,
} from "react-aria-components";
import { graphql, useFragment } from "react-relay";

import { Button, ButtonProps } from "@phoenix/components/button";
import { CreateDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateDatasetEvaluatorSlideover";
import { AddEvaluatorMenu_codeEvaluatorTemplates$key } from "@phoenix/components/evaluators/__generated__/AddEvaluatorMenu_codeEvaluatorTemplates.graphql";
import { AddEvaluatorMenu_query$key } from "@phoenix/components/evaluators/__generated__/AddEvaluatorMenu_query.graphql";
import { EvaluatorConfigDialog } from "@phoenix/components/evaluators/EvaluatorConfigDialog";
import { EvaluatorSelectMenuItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
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
  const [createEvaluatorDialogOpen, setCreateEvaluatorDialogOpen] =
    useState(false);
  const [evaluatorIdToAssociate, setEvaluatorIdToAssociate] = useState<
    string | null
  >(null);
  const associateEvaluatorDialogOpen = evaluatorIdToAssociate != null;
  const onCloseEvaluatorConfigDialog = () => {
    setEvaluatorIdToAssociate(null);
  };
  const data = useFragment<AddEvaluatorMenu_query$key>(
    graphql`
      fragment AddEvaluatorMenu_query on Query
      @argumentDefinitions(datasetId: { type: "ID!" }) {
        ...AddEvaluatorMenu_codeEvaluatorTemplates
        dataset: node(id: $datasetId) {
          ... on Dataset {
            ...EvaluatorConfigDialog_dataset
          }
        }
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
          <Menu
            onAction={(action) => {
              switch (action) {
                case "createEvaluator":
                  setCreateEvaluatorDialogOpen(true);
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
                query={data}
                onAction={setEvaluatorIdToAssociate}
              >
                <MenuItem
                  leadingContent={<Icon svg={<Icons.SquiggleOutline />} />}
                >
                  Use built-in code evaluator
                </MenuItem>
              </CodeEvaluatorTemplateSubmenu>
            </MenuSection>
          </Menu>
        </MenuContainer>
      </MenuTrigger>
      <DialogTrigger
        isOpen={createEvaluatorDialogOpen}
        onOpenChange={setCreateEvaluatorDialogOpen}
      >
        <CreateDatasetEvaluatorSlideover
          datasetId={datasetId}
          updateConnectionIds={updateConnectionIds}
        />
      </DialogTrigger>
      <ModalOverlay
        isOpen={associateEvaluatorDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEvaluatorIdToAssociate(null);
          }
        }}
      >
        <Modal size="fullscreen" variant="slideover">
          <EvaluatorConfigDialog
            evaluatorId={evaluatorIdToAssociate}
            onClose={onCloseEvaluatorConfigDialog}
            datasetRef={data.dataset}
          />
        </Modal>
      </ModalOverlay>
    </>
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
            <EvaluatorSelectMenuItem
              evaluator={evaluator}
              onSelectionChange={() => onAction(evaluator.id)}
            />
          )}
        </Menu>
      </MenuContainer>
    </SubmenuTrigger>
  );
};
