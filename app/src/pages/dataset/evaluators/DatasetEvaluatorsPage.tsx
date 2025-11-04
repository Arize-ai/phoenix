import { useMemo, useState } from "react";
import { graphql, useFragment, usePreloadedQuery } from "react-relay";
import { useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Flex, Modal, ModalOverlay, View } from "@phoenix/components";
import { EvaluatorSelect } from "@phoenix/components/evaluators/EvaluatorSelect";
import {
  datasetEvaluatorsLoader,
  datasetEvaluatorsLoaderGQL,
} from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";
import { EvaluatorConfigDialog } from "@phoenix/pages/dataset/evaluators/EvaluatorConfigDialog";

import type { DatasetEvaluatorsPage_evaluators$key } from "./__generated__/DatasetEvaluatorsPage_evaluators.graphql";

export function DatasetEvaluatorsPage() {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");

  const loaderData = useLoaderData<typeof datasetEvaluatorsLoader>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery(datasetEvaluatorsLoaderGQL, loaderData);

  const globalEvaluatorsData =
    useFragment<DatasetEvaluatorsPage_evaluators$key>(
      graphql`
        fragment DatasetEvaluatorsPage_evaluators on Query
        @argumentDefinitions(datasetId: { type: "ID!" }) {
          evaluators(first: 100) {
            edges {
              node {
                id
                name
                kind
                isAssignedToDataset(datasetId: $datasetId)
              }
            }
          }
        }
      `,
      data
    );

  const [addingEvaluatorId, setAddingEvaluatorId] = useState<string | null>(
    null
  );

  const onCloseEvaluatorConfigDialog = () => {
    setAddingEvaluatorId(null);
  };

  const globalEvaluators = useMemo(
    () =>
      globalEvaluatorsData.evaluators.edges.map((edge) => ({
        id: edge.node.id,
        name: edge.node.name,
        kind: edge.node.kind,
        alreadyAdded: edge.node.isAssignedToDataset,
      })),
    [globalEvaluatorsData]
  );

  return (
    <main>
      <View padding="size-200">
        <Flex direction="row" gap="size-200" justifyContent="end">
          <EvaluatorSelect
            evaluators={globalEvaluators}
            onSelectionChange={(evaluatorId) => {
              setAddingEvaluatorId(evaluatorId);
            }}
            addNewEvaluatorLink="/evaluators/new"
            selectionMode="single"
          />
        </Flex>
      </View>
      <ModalOverlay
        isOpen={!!addingEvaluatorId}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setAddingEvaluatorId(null);
          }
        }}
      >
        <Modal size="L">
          {addingEvaluatorId && (
            <EvaluatorConfigDialog
              evaluatorId={addingEvaluatorId}
              onClose={onCloseEvaluatorConfigDialog}
              datasetRef={data.dataset}
            />
          )}
        </Modal>
      </ModalOverlay>
    </main>
  );
}
