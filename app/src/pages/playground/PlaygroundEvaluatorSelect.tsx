import { useState } from "react";
import { GridListSection } from "react-aria-components";
import { css } from "@emotion/react";

import {
  Button,
  DialogTrigger,
  GridList,
  GridListSectionTitle,
  Icon,
  Icons,
  MenuContainer,
  Separator,
  Text,
} from "@phoenix/components";
import { CreateBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateBuiltInDatasetEvaluatorSlideover";
import {
  CreateLLMDatasetEvaluatorInitialState,
  CreateLLMDatasetEvaluatorSlideover,
} from "@phoenix/components/dataset/CreateLLMDatasetEvaluatorSlideover";
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { EditLLMDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditLLMDatasetEvaluatorSlideover";
import type { EvaluatorKind } from "@phoenix/components/evaluators/__generated__/AddEvaluatorMenu_codeEvaluatorTemplates.graphql";
import {
  AddEvaluatorMenuContents,
  BuiltInEvaluatorsQueryKey,
} from "@phoenix/components/evaluators/AddEvaluatorMenu";
import {
  EvaluatorItem,
  EvaluatorSelectMenuItem,
} from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import { isStringArray } from "@phoenix/typeUtils";

type PlaygroundEvaluatorSelectProps = {
  datasetId: string;
  evaluators: EvaluatorItem[];
  selectedIds?: string[];
  onSelectionChange: (keys: string[]) => void;
  builtInEvaluatorsQuery: BuiltInEvaluatorsQueryKey;
  updateConnectionIds: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
};

export function PlaygroundEvaluatorSelect(
  props: PlaygroundEvaluatorSelectProps
) {
  const {
    evaluators,
    selectedIds,
    onSelectionChange,
    builtInEvaluatorsQuery,
    datasetId,
    updateConnectionIds,
    onEvaluatorCreated,
  } = props;

  const [editingEvaluator, setEditingEvaluator] = useState<{
    datasetEvaluatorId: string;
    kind: EvaluatorKind;
    isBuiltIn: boolean;
  } | null>(null);
  const [builtinEvaluatorIdToAssociate, setBuiltinEvaluatorIdToAssociate] =
    useState<string | null>(null);
  const associateBuiltinEvaluatorDialogOpen =
    builtinEvaluatorIdToAssociate != null;
  const onCloseAssociateBuiltinEvaluatorDialog = () => {
    setBuiltinEvaluatorIdToAssociate(null);
  };
  const [evaluatorMenuOpen, setEvaluatorMenuOpen] = useState(false);

  const [
    createLLMEvaluatorDialogInitialState,
    setCreateLLMEvaluatorDialogInitialState,
  ] = useState<CreateLLMDatasetEvaluatorInitialState | boolean | null>(null);

  const onEdit = ({
    datasetEvaluatorId,
    kind,
    isBuiltIn,
  }: {
    datasetEvaluatorId: string;
    kind: EvaluatorKind;
    isBuiltIn: boolean;
  }) => {
    setEditingEvaluator({ datasetEvaluatorId, kind, isBuiltIn });
    setEvaluatorMenuOpen(false);
  };

  return (
    <>
      <DialogTrigger
        isOpen={evaluatorMenuOpen}
        onOpenChange={setEvaluatorMenuOpen}
      >
        <Button size="S" leadingVisual={<Icon svg={<Icons.PlusOutline />} />}>
          Add evaluator
        </Button>
        <MenuContainer placement="top end" shouldFlip={true}>
          <GridList
            selectionMode="multiple"
            selectedKeys={selectedIds}
            onSelectionChange={(keys) => {
              if (keys === "all") {
                return;
              }
              const keysArray = Array.from(keys);
              if (!isStringArray(keysArray)) {
                return;
              }
              onSelectionChange(keysArray);
            }}
            renderEmptyState={() => (
              <Text color="grey-300" size="S">
                No evaluators found
              </Text>
            )}
            css={css`
              max-width: 600px;
            `}
            aria-label="Select evaluators"
          >
            <GridListSection>
              <GridListSectionTitle title="Evaluators" />
              {evaluators.map((evaluator) => (
                <EvaluatorSelectMenuItem
                  key={evaluator.id}
                  evaluator={evaluator}
                  isSelected={selectedIds?.includes(evaluator.id) ?? false}
                  onEdit={() =>
                    onEdit({
                      datasetEvaluatorId: evaluator.id,
                      kind: evaluator.kind,
                      isBuiltIn: evaluator.isBuiltIn,
                    })
                  }
                />
              ))}
            </GridListSection>
          </GridList>
          <Separator />
          <AddEvaluatorMenuContents
            query={builtInEvaluatorsQuery}
            onCreateEvaluator={() =>
              setCreateLLMEvaluatorDialogInitialState(true)
            }
            onSelectBuiltInCodeEvaluator={setBuiltinEvaluatorIdToAssociate}
            onSelectBuiltInLLMEvaluator={(initialState) => {
              setCreateLLMEvaluatorDialogInitialState(initialState);
            }}
          />
        </MenuContainer>
      </DialogTrigger>
      <EditLLMDatasetEvaluatorSlideover
        datasetEvaluatorId={editingEvaluator?.datasetEvaluatorId}
        datasetId={datasetId}
        isOpen={
          editingEvaluator !== null &&
          editingEvaluator.kind === "LLM" &&
          editingEvaluator.isBuiltIn === false
        }
        onOpenChange={(open) => {
          if (!open) {
            setEditingEvaluator(null);
          }
        }}
        updateConnectionIds={updateConnectionIds}
      />
      <EditBuiltInDatasetEvaluatorSlideover
        datasetEvaluatorId={editingEvaluator?.datasetEvaluatorId}
        datasetId={datasetId}
        isOpen={editingEvaluator !== null && editingEvaluator.isBuiltIn}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEvaluator(null);
          }
        }}
        updateConnectionIds={updateConnectionIds}
      />
      <CreateBuiltInDatasetEvaluatorSlideover
        evaluatorId={builtinEvaluatorIdToAssociate}
        datasetId={datasetId}
        isOpen={associateBuiltinEvaluatorDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            onCloseAssociateBuiltinEvaluatorDialog();
          }
        }}
        onEvaluatorCreated={onEvaluatorCreated}
        updateConnectionIds={updateConnectionIds}
      />
      <CreateLLMDatasetEvaluatorSlideover
        isOpen={!!createLLMEvaluatorDialogInitialState}
        onOpenChange={setCreateLLMEvaluatorDialogInitialState}
        datasetId={datasetId}
        updateConnectionIds={updateConnectionIds}
        initialState={
          createLLMEvaluatorDialogInitialState &&
          typeof createLLMEvaluatorDialogInitialState === "object"
            ? createLLMEvaluatorDialogInitialState
            : undefined
        }
        onEvaluatorCreated={onEvaluatorCreated}
      />
    </>
  );
}
