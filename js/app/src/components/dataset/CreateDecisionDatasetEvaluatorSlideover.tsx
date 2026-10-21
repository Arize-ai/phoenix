import { Suspense, useMemo } from "react";

import { Dialog } from "@phoenix/components/core/dialog";
import { Loading } from "@phoenix/components/core/loading";
import type { ViewportModalOverlayProps } from "@phoenix/components/core/overlay";
import {
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components/core/overlay";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import {
  DEFAULT_STORE_VALUES,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";

import { DecisionDatasetEvaluatorForm } from "./DecisionDatasetEvaluatorForm";

export const CreateDecisionDatasetEvaluatorSlideover = ({
  datasetId,
  updateConnectionIds,
  onEvaluatorCreated,
  ...props
}: {
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
} & Omit<ViewportModalOverlayProps, "children">) => {
  return (
    <ViewportModalOverlay {...props}>
      <ViewportModal size="fullscreen">
        <Dialog aria-label="Create decision evaluator">
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              {datasetId && (
                <CreateDecisionEvaluatorDialog
                  onClose={close}
                  datasetId={datasetId}
                  updateConnectionIds={updateConnectionIds}
                  onEvaluatorCreated={onEvaluatorCreated}
                />
              )}
            </Suspense>
          )}
        </Dialog>
      </ViewportModal>
    </ViewportModalOverlay>
  );
};

type CreateDecisionEvaluatorDialogProps = {
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
};

const CreateDecisionEvaluatorDialog = (
  props: CreateDecisionEvaluatorDialogProps
) => {
  const { datasetId } = props;
  const initialState = useMemo(
    () =>
      ({
        ...DEFAULT_STORE_VALUES,
        evaluator: {
          ...DEFAULT_STORE_VALUES.evaluator,
          kind: "DECISION",
          isBuiltin: false,
        },
        outputConfigs: [],
        dataset: {
          readonly: true,
          id: datasetId,
          selectedExampleId: null,
          selectedSplitIds: [],
        },
      }) satisfies EvaluatorStoreProps,
    [datasetId]
  );
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      <CreateDecisionEvaluatorDialogContent {...props} />
    </EvaluatorStoreProvider>
  );
};

const CreateDecisionEvaluatorDialogContent = (
  props: CreateDecisionEvaluatorDialogProps
) => (
  <DecisionDatasetEvaluatorForm
    {...props}
    onSaved={props.onEvaluatorCreated}
  />
);
