import { useState } from "react";
import { GridListSection } from "react-aria-components";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Counter,
  DialogTrigger,
  GridList,
  GridListSectionTitle,
  Icon,
  Icons,
  MenuContainer,
  Separator,
} from "@phoenix/components";
import { CreateBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateBuiltInDatasetEvaluatorSlideover";
import {
  CreateLLMDatasetEvaluatorInitialState,
  CreateLLMDatasetEvaluatorSlideover,
} from "@phoenix/components/dataset/CreateLLMDatasetEvaluatorSlideover";
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { EditLLMDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditLLMDatasetEvaluatorSlideover";
import type { EvaluatorKind } from "@phoenix/components/evaluators/__generated__/AddEvaluatorMenu_codeEvaluatorTemplates.graphql";
import { AddEvaluatorMenuContents } from "@phoenix/components/evaluators/AddEvaluatorMenu";
import {
  EvaluatorItem,
  EvaluatorSelectMenuItem,
} from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import { isStringArray } from "@phoenix/typeUtils";

import { PlaygroundEvaluatorSelect_query$key } from "./__generated__/PlaygroundEvaluatorSelect_query.graphql";

type PlaygroundEvaluatorSelectProps = {
  datasetId: string;
  evaluators: EvaluatorItem[];
  selectedIds: string[];
  onSelectionChange: (keys: string[]) => void;
  updateConnectionIds: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
  query: PlaygroundEvaluatorSelect_query$key;
  isDisabled?: boolean;
};

export function PlaygroundEvaluatorSelect(
  props: PlaygroundEvaluatorSelectProps
) {
  const {
    evaluators,
    selectedIds,
    onSelectionChange,
    datasetId,
    updateConnectionIds,
    onEvaluatorCreated,
    query,
    isDisabled,
  } = props;

  const data = useFragment<PlaygroundEvaluatorSelect_query$key>(
    graphql`
      fragment PlaygroundEvaluatorSelect_query on Query {
        ...AddEvaluatorMenu_codeEvaluatorTemplates
        ...AddEvaluatorMenu_llmEvaluatorTemplates
      }
    `,
    query
  );

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
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.Scale />} />}
          isDisabled={isDisabled}
        >
          Evaluators{" "}
          {selectedIds.length > 0 && <Counter>{selectedIds.length}</Counter>}
        </Button>
        <MenuContainer placement="top end" shouldFlip={true} minHeight="0">
          {evaluators.length > 0 && (
            <>
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
            </>
          )}
          <AddEvaluatorMenuContents
            query={data}
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
