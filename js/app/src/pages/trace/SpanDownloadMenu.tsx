import { useState } from "react";

import {
  Alert,
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
  View,
} from "@phoenix/components";
import { SpanDownloadDialog } from "@phoenix/components/trace/SpanDownloadDialog";
import {
  downloadSingleSpan,
  getSpanDownloadTimestamp,
  sanitizeSpanDownloadFileName,
  type SingleSpanDownloadFormat,
} from "@phoenix/components/trace/spanDownloadUtils";

enum SpanDownloadAction {
  SPAN_JSON = "span-json",
  SPAN_OTLP_JSON = "span-otlp-json",
  TRACE = "trace",
}

type SpanDownloadMenuProps = {
  projectId: string;
  spanId: string;
  traceId: string;
  buttonText: string | null;
};

/** Span-detail download actions for the current span and its trace. */
export function SpanDownloadMenu({
  projectId,
  spanId,
  traceId,
  buttonText,
}: SpanDownloadMenuProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTraceDialogOpen, setIsTraceDialogOpen] = useState(false);

  const onDownloadSpan = async (format: SingleSpanDownloadFormat) => {
    setIsDownloading(true);
    setDownloadError(null);
    const timestamp = getSpanDownloadTimestamp();
    const safeTraceId = sanitizeSpanDownloadFileName(traceId);
    const formatSuffix = format === "otlp-json" ? "-otlp" : "";
    try {
      await downloadSingleSpan({
        projectId,
        spanId,
        format,
        fileName: `${safeTraceId}-span-${spanId}${formatSuffix}-${timestamp}.json`,
        includeSpanAnnotations: true,
        includeTraceAnnotations: true,
      });
    } catch (error) {
      setDownloadError(
        `Failed to download span: ${error instanceof Error ? error.message : String(error)}`
      );
      setIsMenuOpen(true);
    } finally {
      setIsDownloading(false);
    }
  };

  const disabledKeys = isDownloading
    ? [SpanDownloadAction.SPAN_JSON, SpanDownloadAction.SPAN_OTLP_JSON]
    : [];

  return (
    <>
      <MenuTrigger
        isOpen={isMenuOpen}
        onOpenChange={(isOpen) => {
          setIsMenuOpen(isOpen);
          if (isOpen) {
            setDownloadError(null);
          }
        }}
      >
        <Button
          size="S"
          aria-label="Download span"
          leadingVisual={<Icon svg={<Icons.Download />} />}
          isDisabled={isDownloading}
        >
          {buttonText}
        </Button>
        <Popover placement="bottom end">
          {downloadError ? (
            <View padding="size-100">
              <Alert variant="danger" banner>
                {downloadError}
              </Alert>
            </View>
          ) : null}
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
              fileNamePrefix={traceId}
              selectedSpans={[{ spanId, trace: { traceId } }]}
              initialScope="traces"
            />
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </>
  );
}
