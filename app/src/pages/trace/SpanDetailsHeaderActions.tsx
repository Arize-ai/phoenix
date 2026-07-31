import { Suspense } from "react";
import { useNavigate } from "react-router";

import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  LinkButton,
  Loading,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";

import { SpanDownloadMenu } from "./SpanDownloadMenu";
import { SpanToDatasetExampleDialog } from "./SpanToDatasetExampleDialog";

export function SpanDetailsHeaderActions({
  buttonText,
  isDisabled = false,
  projectId,
  spanId,
  spanKind,
  spanNodeId,
  traceId,
}: {
  buttonText: {
    addToDataset: string | null;
    download: string | null;
    playground: string | null;
  };
  isDisabled?: boolean;
  projectId?: string;
  spanId?: string;
  spanKind?: string;
  spanNodeId: string;
  traceId?: string;
}) {
  const isPlaygroundDisabled = isDisabled || spanKind !== "llm";
  const isDownloadDisabled =
    isDisabled || projectId == null || spanId == null || traceId == null;

  return (
    <>
      <LinkButton
        variant={spanKind === "llm" ? "primary" : "default"}
        leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
        isDisabled={isPlaygroundDisabled}
        to={`/playground/spans/${spanNodeId}`}
        size="S"
        aria-label="Prompt Playground"
      >
        {buttonText.playground}
      </LinkButton>
      <AddSpanToDatasetButton
        spanNodeId={spanNodeId}
        buttonText={buttonText.addToDataset}
        isDisabled={isDisabled}
      />
      <SpanDownloadMenu
        projectId={projectId ?? ""}
        spanId={spanId ?? ""}
        traceId={traceId ?? ""}
        buttonText={buttonText.download}
        isDisabled={isDownloadDisabled}
      />
    </>
  );
}

function AddSpanToDatasetButton({
  spanNodeId,
  buttonText,
  isDisabled,
}: {
  spanNodeId: string;
  buttonText: string | null;
  isDisabled: boolean;
}) {
  const notifySuccess = useNotifySuccess();
  const navigate = useNavigate();
  return (
    <DialogTrigger>
      <Button
        variant="default"
        size="S"
        leadingVisual={<Icon svg={<Icons.Database />} />}
        isDisabled={isDisabled}
        aria-label="Add to Dataset"
      >
        {buttonText}
      </Button>
      <ViewportModalOverlay>
        <ViewportModal size="L">
          <Suspense fallback={<Loading />}>
            <SpanToDatasetExampleDialog
              spanId={spanNodeId}
              onCompleted={(datasetId) => {
                notifySuccess({
                  title: "Span Added to Dataset",
                  message: "Successfully added span to dataset",
                  action: {
                    text: "View Dataset",
                    onClick: () => navigate(`/datasets/${datasetId}/examples`),
                  },
                });
              }}
            />
          </Suspense>
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
