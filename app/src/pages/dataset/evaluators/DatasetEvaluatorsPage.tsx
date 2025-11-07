import { Suspense, useMemo, useState } from "react";
import { graphql, useFragment, usePreloadedQuery } from "react-relay";
import { useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Loading, Modal, ModalOverlay } from "@phoenix/components";
import { EvaluatorSelect } from "@phoenix/components/evaluators/EvaluatorSelect";
import {
  datasetEvaluatorsLoader,
  datasetEvaluatorsLoaderGQL,
} from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";
import { DatasetEvaluatorsTable } from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorsTable";
import { EvaluatorConfigDialog } from "@phoenix/pages/dataset/evaluators/EvaluatorConfigDialog";
import { EvaluatorsFilterBar } from "@phoenix/pages/evaluators/EvaluatorsFilterBar";
import { EvaluatorsFilterProvider } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";

import type { DatasetEvaluatorsPage_evaluators$key } from "./__generated__/DatasetEvaluatorsPage_evaluators.graphql";

export function DatasetEvaluatorsPage() {
  return (
    <EvaluatorsFilterProvider>
      <Suspense fallback={<Loading />}>
        <DatasetEvaluatorsPageContent />
      </Suspense>
    </EvaluatorsFilterProvider>
  );
}

export function DatasetEvaluatorsPageContent() {
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
          globalEvaluators: evaluators(first: 100) {
            edges {
              node {
                id
                name
                kind
                isAssignedToDataset(datasetId: $datasetId)
                ... on LLMEvaluator {
                  outputConfig {
                    name
                  }
                }
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
      globalEvaluatorsData.globalEvaluators.edges.map((edge) => ({
        id: edge.node.id,
        name: edge.node.name,
        kind: edge.node.kind,
        alreadyAdded: edge.node.isAssignedToDataset,
        annotationName: edge.node.outputConfig?.name,
      })),
    [globalEvaluatorsData]
  );

  return (
    <main>
      <EvaluatorsFilterBar
        padding="size-100"
        extraActions={
          <EvaluatorSelect
            size="M"
            evaluators={globalEvaluators}
            onSelectionChange={(evaluatorId) => {
              setAddingEvaluatorId(evaluatorId);
            }}
            addNewEvaluatorLink="/evaluators/new"
            selectionMode="single"
          />
        }
      />
      <Suspense fallback={<Loading />}>
        <DatasetEvaluatorsTable query={data.dataset} />
      </Suspense>
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
