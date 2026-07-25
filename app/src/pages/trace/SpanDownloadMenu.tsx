import { useState } from "react";

import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
} from "@phoenix/components";
import { SpanDownloadDialog } from "@phoenix/components/trace/SpanDownloadDialog";
import {
  downloadSingleSpan,
  getSpanDownloadTimestamp,
  sanitizeSpanDownloadFileName,
  type SingleSpanDownloadFormat,
} from "@phoenix/components/trace/spanDownloadUtils";
import { useNotifyError } from "@phoenix/contexts";

enum SpanDownloadAction {
  SPAN_JSON = "span-json",
  SPAN_OTLP_JSON = "span-otlp-json",
  TRACE = "trace",
}

type SpanDownloadMenuProps = {
  projectId: string;
  projectName: string;
  spanId: string;
  traceId: string;
  buttonText: string | null;
};

/** Span-detail download actions for the current span and its trace. */
export function SpanDownloadMenu({
  projectId,
  projectName,
  spanId,
  traceId,
  buttonText,
}: SpanDownloadMenuProps) {
  const notifyError = useNotifyError();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isTraceDialogOpen, setIsTraceDialogOpen] = useState(false);

  const onDownloadSpan = async (format: SingleSpanDownloadFormat) => {
    setIsDownloading(true);
    const timestamp = getSpanDownloadTimestamp();
    const safeProjectName = sanitizeSpanDownloadFileName(projectName);
    const formatSuffix = format === "otlp-json" ? "-otlp" : "";
    try {
      await downloadSingleSpan({
        projectId,
        spanId,
        format,
        fileName: `${safeProjectName}-span-${spanId}${formatSuffix}-${timestamp}.json`,
      });
    } catch (error) {
      notifyError({
        title: "Failed to download span",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const disabledKeys = isDownloading
    ? [SpanDownloadAction.SPAN_JSON, SpanDownloadAction.SPAN_OTLP_JSON]
    : [];

  return (
    <>
      <MenuTrigger>
        <Button
          size="S"
          aria-label="Download span"
          leadingVisual={<Icon svg={<Icons.Download />} />}
          isDisabled={isDownloading}
        >
          {buttonText}
        </Button>
        <Popover placement="bottom end">
          <Menu
            aria-label="Span download options"
            disabledKeys={disabledKeys}
            onAction={(action) => {
              switch (action) {
                case SpanDownloadAction.SPAN_JSON:
                  void onDownloadSpan("json");
                  break;
                case SpanDownloadAction.SPAN_OTLP_JSON:
                  void onDownloadSpan("otlp-json");
                  break;
                case SpanDownloadAction.TRACE:
                  setIsTraceDialogOpen(true);
                  break;
              }
            }}
          >
            <MenuItem id={SpanDownloadAction.SPAN_JSON}>
              Download span JSON
            </MenuItem>
            <MenuItem id={SpanDownloadAction.SPAN_OTLP_JSON}>
              Download span OTLP JSON
            </MenuItem>
            <MenuItem id={SpanDownloadAction.TRACE}>Download trace</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <DialogTrigger
        isOpen={isTraceDialogOpen}
        onOpenChange={setIsTraceDialogOpen}
      >
        <ModalOverlay>
          <Modal size="S">
            <SpanDownloadDialog
              projectId={projectId}
              projectName={projectName}
              selectedSpans={[{ spanId, trace: { traceId } }]}
              initialScope="traces"
              onError={(message) => {
                notifyError({
                  title: "Failed to download trace",
                  message,
                });
              }}
            />
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </>
  );
}
