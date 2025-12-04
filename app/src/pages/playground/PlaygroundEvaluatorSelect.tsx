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
  } = props;

  const [editingEvaluator, setEditingEvaluator] = useState<{
    datasetEvaluatorId: string;
    kind: EvaluatorKind;
    isBuiltIn: boolean;
  } | null>(null);
  const [evaluatorMenuOpen, setEvaluatorMenuOpen] = useState(false);

  const [createEvaluatorDialogOpen, setCreateEvaluatorDialogOpen] = useState<
    CreateLLMDatasetEvaluatorInitialState | boolean | null
  >(null);

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
            onCreateEvaluator={() => setCreateEvaluatorDialogOpen(true)}
            onSelectBuiltInCodeEvaluator={() =>
              setCreateEvaluatorDialogOpen(true)
            }
            onSelectBuiltInLLMEvaluator={(initialState) => {
              setCreateEvaluatorDialogOpen(initialState);
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
      />
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
    </>
  );
}
