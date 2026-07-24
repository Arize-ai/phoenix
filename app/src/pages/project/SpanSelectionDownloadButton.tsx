import { css } from "@emotion/react";
import { useState } from "react";

import type { components } from "@phoenix/api/__generated__/v1";
import { authApiFetch } from "@phoenix/api/authApiFetch";
import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  ContextualHelp,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Text,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  View,
} from "@phoenix/components";

import type { SelectedSpan } from "./SpanSelectionToolbar";

type OtlpSpan = components["schemas"]["OtlpSpan"];
type PhoenixSpan = components["schemas"]["Span"];

const PAGE_SIZE = 1000;

type SpanSearchQuery = {
  limit: number;
  span_id?: string[];
  trace_id?: string[];
  cursor?: string;
};

type DownloadScope = "spans" | "traces";
type DownloadFormat = "jsonl" | "otlp-json";

const FILE_EXTENSIONS: Record<DownloadFormat, string> = {
  jsonl: ".jsonl",
  "otlp-json": ".json",
};

// Match the label styling of the field components (e.g. TextField)
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
 * Makes a name safe to use in a file name.
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_");
}

/**
 * Follows pagination cursors until the result set is exhausted, accumulating
 * the spans from each page.
 */
async function fetchAllPages<Span>({
  fetchPage,
}: {
  fetchPage: (
    cursor: string | null
  ) => Promise<{ data?: Span[]; next_cursor?: string | null } | undefined>;
}): Promise<Span[]> {
  const spans: Span[] = [];
  let cursor: string | null = null;
  do {
    const page = await fetchPage(cursor);
    if (page?.data == null) {
      throw new Error("request failed");
    }
    spans.push(...page.data);
    cursor = page.next_cursor ?? null;
  } while (cursor);
  return spans;
}

function buildSpanSearchQuery({
  spanIds,
  traceIds,
  cursor,
}: {
  spanIds?: string[];
  traceIds?: string[];
  cursor: string | null;
}): SpanSearchQuery {
  return {
    limit: PAGE_SIZE,
    ...(spanIds ? { span_id: spanIds } : {}),
    ...(traceIds ? { trace_id: traceIds } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

/**
 * Fetches all OTLP spans matching the given span or trace IDs.
 */
async function fetchOtlpSpans({
  projectId,
  spanIds,
  traceIds,
}: {
  projectId: string;
  spanIds?: string[];
  traceIds?: string[];
}): Promise<OtlpSpan[]> {
  return fetchAllPages({
    fetchPage: async (cursor) => {
      const { data } = await authApiFetch.GET(
        "/v1/projects/{project_identifier}/spans/otlpv1",
        {
          params: {
            path: { project_identifier: projectId },
            query: buildSpanSearchQuery({ spanIds, traceIds, cursor }),
          },
        }
      );
      return data;
    },
  });
}

/**
 * Fetches all spans in the Phoenix span format matching the given span or
 * trace IDs.
 */
async function fetchPhoenixSpans({
  projectId,
  spanIds,
  traceIds,
}: {
  projectId: string;
  spanIds?: string[];
  traceIds?: string[];
}): Promise<PhoenixSpan[]> {
  return fetchAllPages({
    fetchPage: async (cursor) => {
      const { data } = await authApiFetch.GET(
        "/v1/projects/{project_identifier}/spans",
        {
          params: {
            path: { project_identifier: projectId },
            query: buildSpanSearchQuery({ spanIds, traceIds, cursor }),
          },
        }
      );
      return data;
    },
  });
}

function downloadBlob({ fileName, blob }: { fileName: string; blob: Blob }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJson({
  fileName,
  payload,
}: {
  fileName: string;
  payload: unknown;
}) {
  downloadBlob({
    fileName,
    blob: new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    }),
  });
}

/**
 * Downloads records as JSONL — one JSON object per line.
 */
function downloadJsonl({
  fileName,
  records,
}: {
  fileName: string;
  records: unknown[];
}) {
  downloadBlob({
    fileName,
    blob: new Blob(
      [records.map((record) => JSON.stringify(record)).join("\n") + "\n"],
      { type: "application/x-ndjson" }
    ),
  });
}

type SpanSelectionDownloadButtonProps = {
  projectId: string;
  projectName: string;
  selectedSpans: SelectedSpan[];
  onError: (message: string) => void;
};

/**
 * A button that opens a dialog to download the selected spans, or the full
 * traces they belong to, as a JSONL or OTLP JSON file.
 */
export function SpanSelectionDownloadButton(
  props: SpanSelectionDownloadButtonProps
) {
  return (
    <DialogTrigger>
      <Button
        size="M"
        aria-label="Download selection"
        leadingVisual={<Icon svg={<Icons.Download />} />}
      />
      <ModalOverlay>
        <Modal size="S">
          <SpanSelectionDownloadDialog {...props} />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

function SpanSelectionDownloadDialog({
  projectId,
  projectName,
  selectedSpans,
  onError,
}: SpanSelectionDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [scope, setScope] = useState<DownloadScope>("spans");
  const [format, setFormat] = useState<DownloadFormat>("jsonl");
  const [timestamp] = useState(() =>
    new Date().toISOString().slice(0, 19).replace(/:/g, "-")
  );
  const defaultFileName = (scope: DownloadScope) =>
    `${sanitizeFileName(projectName)}-${scope}-${timestamp}`;
  const [fileName, setFileName] = useState(() => defaultFileName("spans"));
  const [isFileNameEdited, setIsFileNameEdited] = useState(false);

  const onDownload = async (close: () => void) => {
    setIsDownloading(true);
    const extension = FILE_EXTENSIONS[format];
    const fullFileName = fileName.endsWith(extension)
      ? fileName
      : `${fileName}${extension}`;
    const ids =
      scope === "spans"
        ? { spanIds: [...new Set(selectedSpans.map((span) => span.spanId))] }
        : {
            traceIds: [
              ...new Set(selectedSpans.map((span) => span.trace.traceId)),
            ],
          };
    try {
      if (format === "jsonl") {
        const spans = await fetchPhoenixSpans({ projectId, ...ids });
        downloadJsonl({ fileName: fullFileName, records: spans });
      } else {
        const spans = await fetchOtlpSpans({ projectId, ...ids });
        downloadJson({
          fileName: fullFileName,
          payload: { resource_spans: [{ scope_spans: [{ spans }] }] },
        });
      }
      close();
    } catch (error) {
      onError(
        `Failed to download: ${error instanceof Error ? error.message : String(error)}`
      );
      close();
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
              <DialogCloseButton close={close} />
            </DialogTitleExtra>
          </DialogHeader>
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
                  <ToggleButtonGroup
                    selectedKeys={[scope]}
                    disallowEmptySelection
                    aria-label="Data"
                    onSelectionChange={(keys) => {
                      const key = keys.keys().next().value;
                      if (key !== "spans" && key !== "traces") {
                        return;
                      }
                      setScope(key);
                      if (!isFileNameEdited) {
                        setFileName(defaultFileName(key));
                      }
                    }}
                  >
                    <ToggleButton id="spans">Spans</ToggleButton>
                    <ToggleButton id="traces">Traces</ToggleButton>
                  </ToggleButtonGroup>
                </div>
                <div css={labeledGroupCSS}>
                  <Flex direction="row" alignItems="center" gap="size-50">
                    <Label>Format</Label>
                    <ContextualHelp variant="info">
                      <Heading weight="heavy" level={4}>
                        File formats
                      </Heading>
                      <Text>
                        JSONL has one Phoenix span per line. OTLP JSON uses the
                        OpenTelemetry JSON encoding.
                      </Text>
                    </ContextualHelp>
                  </Flex>
                  <ToggleButtonGroup
                    selectedKeys={[format]}
                    disallowEmptySelection
                    aria-label="Format"
                    onSelectionChange={(keys) => {
                      const key = keys.keys().next().value;
                      if (key === "jsonl" || key === "otlp-json") {
                        setFormat(key);
                      }
                    }}
                  >
                    <ToggleButton id="jsonl">JSONL</ToggleButton>
                    <ToggleButton id="otlp-json">OTLP JSON</ToggleButton>
                  </ToggleButtonGroup>
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
                  The {FILE_EXTENSIONS[format]} extension is appended
                  automatically.
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
