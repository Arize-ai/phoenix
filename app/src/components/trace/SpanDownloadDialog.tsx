import { css } from "@emotion/react";
import { useState } from "react";

import {
  Alert,
  Button,
  ContextualHelp,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Heading,
  Icon,
  Icons,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  TextField,
  View,
} from "@phoenix/components";

import {
  downloadSpanCollection,
  getSpanDownloadTimestamp,
  sanitizeSpanDownloadFileName,
  SPAN_DOWNLOAD_FILE_EXTENSIONS,
  type SpanDownloadFormat,
  type SpanDownloadScope,
} from "./spanDownloadUtils";

export type DownloadableSpan = {
  spanId: string;
  trace: {
    traceId: string;
  };
};

export type SpanDownloadDialogProps = {
  projectId: string;
  fileNamePrefix: string;
  selectedSpans: DownloadableSpan[];
  initialScope?: SpanDownloadScope;
};

// Match the label styling of the field components (e.g. TextField).
const labeledGroupCSS = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  .react-aria-Label {
    padding: 5px 0;
    display: inline-block;
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    font-weight: var(--font-weight-heavy);
  }
`;

/**
 * Configures and downloads the selected spans or the complete traces they
 * belong to in JSONL or OTLP JSON format.
 */
export function SpanDownloadDialog({
  projectId,
  fileNamePrefix,
  selectedSpans,
  initialScope = "spans",
}: SpanDownloadDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<SpanDownloadScope>(initialScope);
  const [format, setFormat] = useState<SpanDownloadFormat>("jsonl");
  const [timestamp] = useState(() => getSpanDownloadTimestamp());
  const getDefaultFileName = (downloadScope: SpanDownloadScope) =>
    `${sanitizeSpanDownloadFileName(fileNamePrefix)}-${downloadScope}-${timestamp}`;
  const [fileName, setFileName] = useState(() =>
    getDefaultFileName(initialScope)
  );
  const [isFileNameEdited, setIsFileNameEdited] = useState(false);

  const onDownload = async (close: () => void) => {
    setIsDownloading(true);
    setError(null);
    const extension = SPAN_DOWNLOAD_FILE_EXTENSIONS[format];
    const fullFileName = fileName.endsWith(extension)
      ? fileName
      : `${fileName}${extension}`;
    const idFilter =
      scope === "spans"
        ? { spanIds: [...new Set(selectedSpans.map((span) => span.spanId))] }
        : {
            traceIds: [
              ...new Set(selectedSpans.map((span) => span.trace.traceId)),
            ],
          };
    try {
      await downloadSpanCollection({
        projectId,
        ...idFilter,
        format,
        fileName: fullFileName,
      });
      close();
    } catch (error) {
      setError(
        `Failed to download: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download selection</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton
                close={close}
                aria-label="Close download dialog"
                leadingVisual={<Icon svg={<Icons.Close />} />}
              />
            </DialogTitleExtra>
          </DialogHeader>
          {error ? (
            <View paddingX="size-200" paddingTop="size-100">
              <Alert variant="danger" banner>
                {error}
              </Alert>
            </View>
          ) : null}
          <View padding="size-200">
            <Flex direction="column" gap="size-200">
              <Flex direction="row" gap="size-400">
                <div css={labeledGroupCSS}>
                  <Flex direction="row" alignItems="center" gap="size-50">
                    <Label>Data</Label>
                    <ContextualHelp variant="info">
                      <Heading weight="heavy" level={4}>
                        Spans vs. Traces
                      </Heading>
                      <Text>
                        Spans downloads only the selected spans. Traces
                        downloads every span with a matching trace ID.
                      </Text>
                    </ContextualHelp>
                  </Flex>
                  <SegmentedControl
                    selectedKey={scope}
                    aria-label="Data"
                    onSelectionChange={(key) => {
                      if (key !== "spans" && key !== "traces") {
                        return;
                      }
                      setScope(key);
                      if (!isFileNameEdited) {
                        setFileName(getDefaultFileName(key));
                      }
                    }}
                  >
                    <SegmentedControlItem id="spans">
                      Spans
                    </SegmentedControlItem>
                    <SegmentedControlItem id="traces">
                      Traces
                    </SegmentedControlItem>
                  </SegmentedControl>
                </div>
                <div css={labeledGroupCSS}>
                  <Flex direction="row" alignItems="center" gap="size-50">
                    <Label>Format</Label>
                    <ContextualHelp variant="info">
                      <Heading weight="heavy" level={4}>
                        File formats
                      </Heading>
                      <Text>
                        JSONL has one span per line. OTLP JSON uses the
                        OpenTelemetry JSON encoding.
                      </Text>
                    </ContextualHelp>
                  </Flex>
                  <SegmentedControl
                    selectedKey={format}
                    aria-label="Format"
                    onSelectionChange={(key) => {
                      if (key === "jsonl" || key === "otlp-json") {
                        setFormat(key);
                      }
                    }}
                  >
                    <SegmentedControlItem id="jsonl">
                      JSONL
                    </SegmentedControlItem>
                    <SegmentedControlItem id="otlp-json">
                      OTLP JSON
                    </SegmentedControlItem>
                  </SegmentedControl>
                </div>
              </Flex>
              <TextField
                value={fileName}
                onChange={(value) => {
                  setFileName(value);
                  setIsFileNameEdited(true);
                }}
              >
                <Label>File name</Label>
                <Input />
                <Text slot="description">
                  The {SPAN_DOWNLOAD_FILE_EXTENSIONS[format]} extension is
                  appended automatically.
                </Text>
              </TextField>
            </Flex>
          </View>
          <DialogFooter>
            <Flex direction="row" gap="size-100">
              <Button variant="default" size="M" onPress={close} type="button">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="M"
                leadingVisual={<Icon svg={<Icons.Download />} />}
                isDisabled={isDownloading || fileName.trim() === ""}
                onPress={() => onDownload(close)}
              >
                {isDownloading ? "Downloading..." : "Download"}
              </Button>
            </Flex>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
