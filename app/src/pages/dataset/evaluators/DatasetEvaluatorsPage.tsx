import { Suspense, useMemo, useState } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Loading, Modal, ModalOverlay } from "@phoenix/components";
import { AddEvaluatorMenu } from "@phoenix/components/evaluators/AddEvaluatorMenu";
import {
  datasetEvaluatorsLoader,
  datasetEvaluatorsLoaderGQL,
} from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";
import {
  DatasetEvaluatorsTable,
  useDatasetEvaluatorsTable,
} from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorsTable";
import { EvaluatorConfigDialog } from "@phoenix/pages/dataset/evaluators/EvaluatorConfigDialog";
import { EvaluatorsFilterBar } from "@phoenix/pages/evaluators/EvaluatorsFilterBar";
import { EvaluatorsFilterProvider } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";

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
  const evaluatorsTableProps = useDatasetEvaluatorsTable(data.dataset);
  const evaluatorsTableData = evaluatorsTableProps.data;

  const [addingEvaluatorId, setAddingEvaluatorId] = useState<string | null>(
    null
  );

  const onCloseEvaluatorConfigDialog = () => {
    setAddingEvaluatorId(null);
  };

  const connectionsToUpdate = useMemo(() => {
    if (evaluatorsTableData.evaluators.__id) {
      return [evaluatorsTableData.evaluators.__id];
    }
    return [];
  }, [evaluatorsTableData]);

  return (
    <main>
      <EvaluatorsFilterBar
        padding="size-100"
        extraActions={
          <AddEvaluatorMenu
            size="M"
            datasetId={datasetId}
            updateConnectionIds={connectionsToUpdate}
          />
        }
      />
      <Suspense fallback={<Loading />}>
        <DatasetEvaluatorsTable {...evaluatorsTableProps} />
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
