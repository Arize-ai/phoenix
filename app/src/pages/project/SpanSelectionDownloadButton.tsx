import { css } from "@emotion/react";
import chunk from "lodash/chunk";
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
  ViewportModal,
  ViewportModalOverlay,
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

// Cap IDs per request so the GET query string stays under common
// server/proxy URL-length limits (~8 KB) and the SQL IN() clause stays under
// database bound-parameter limits. Larger selections are split across
// multiple requests.
const ID_BATCH_SIZE = 100;

// Defer object-URL revocation so the browser has time to start reading a
// large blob before the URL is invalidated (matches the FileSaver pattern).
const URL_REVOKE_DELAY_MS = 40_000;

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

type SpanPage<Span> = { data: Span[]; next_cursor?: string | null };

/**
 * Turns an openapi-fetch error into an Error that preserves the HTTP status
 * and any server-provided detail.
 */
function toDownloadError(status: number, error: unknown): Error {
  const detail =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "detail" in error
        ? String((error as { detail: unknown }).detail)
        : "";
  return new Error(detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`);
}

/**
 * Fetches every span matching the given span or trace IDs, handing each page
 * to `onPage` as it arrives. IDs are batched across requests to stay under
 * server/proxy URL-length and database bound-parameter limits, and pagination
 * cursors are followed within each batch. Streaming pages to the caller (over
 * returning one array) lets the payload be serialized incrementally so span
 * objects can be released between pages.
 */
async function fetchSpans<Span>({
  spanIds,
  traceIds,
  fetchPage,
  onPage,
}: {
  spanIds?: string[];
  traceIds?: string[];
  fetchPage: (query: SpanSearchQuery) => Promise<SpanPage<Span>>;
  onPage: (spans: Span[]) => void;
}): Promise<void> {
  const useSpanIds = spanIds != null;
  const idList = spanIds ?? traceIds ?? [];
  for (const batch of chunk(idList, ID_BATCH_SIZE)) {
    let cursor: string | null = null;
    do {
      const page = await fetchPage({
        limit: PAGE_SIZE,
        ...(useSpanIds ? { span_id: batch } : { trace_id: batch }),
        ...(cursor ? { cursor } : {}),
      });
      onPage(page.data);
      cursor = page.next_cursor ?? null;
    } while (cursor);
  }
}

async function fetchOtlpSpanPage(
  projectId: string,
  query: SpanSearchQuery
): Promise<SpanPage<OtlpSpan>> {
  const { data, error, response } = await authApiFetch.GET(
    "/v1/projects/{project_identifier}/spans/otlpv1",
    { params: { path: { project_identifier: projectId }, query } }
  );
  if (data == null) {
    throw toDownloadError(response.status, error);
  }
  return data;
}

async function fetchSpanPage(
  projectId: string,
  query: SpanSearchQuery
): Promise<SpanPage<PhoenixSpan>> {
  const { data, error, response } = await authApiFetch.GET(
    "/v1/projects/{project_identifier}/spans",
    { params: { path: { project_identifier: projectId }, query } }
  );
  if (data == null) {
    throw toDownloadError(response.status, error);
  }
  return data;
}

/**
 * Downloads the assembled blob parts as a file. The parts are concatenated by
 * the Blob constructor in native memory, avoiding a single giant JS string
 * (which would hit the max-string-length limit for large exports).
 */
function downloadBlob({
  fileName,
  parts,
  type,
}: {
  fileName: string;
  parts: BlobPart[];
  type: string;
}) {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY_MS);
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
      <ViewportModalOverlay>
        <ViewportModal size="S">
          <SpanSelectionDownloadDialog {...props} />
        </ViewportModal>
      </ViewportModalOverlay>
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
  const defaultFileName = (forScope: DownloadScope) =>
    `${sanitizeFileName(projectName)}-${forScope}-${timestamp}`;
  const [fileName, setFileName] = useState(() => defaultFileName("spans"));
  const [isFileNameEdited, setIsFileNameEdited] = useState(false);

  const onDownload = async (close: () => void) => {
    setIsDownloading(true);
    const extension = FILE_EXTENSIONS[format];
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
    // Serialize each page into string parts as it arrives so span objects can
    // be released between pages and no single giant string is built.
    const parts: BlobPart[] = [];
    try {
      if (format === "jsonl") {
        await fetchSpans<PhoenixSpan>({
          ...idFilter,
          fetchPage: (query) => fetchSpanPage(projectId, query),
          onPage: (spans) => {
            if (spans.length === 0) {
              return;
            }
            parts.push(spans.map((span) => JSON.stringify(span)).join("\n"));
            parts.push("\n");
          },
        });
        downloadBlob({
          fileName: fullFileName,
          parts,
          type: "application/x-ndjson",
        });
      } else {
        parts.push('{"resource_spans":[{"scope_spans":[{"spans":[');
        let isFirstPage = true;
        await fetchSpans<OtlpSpan>({
          ...idFilter,
          fetchPage: (query) => fetchOtlpSpanPage(projectId, query),
          onPage: (spans) => {
            if (spans.length === 0) {
              return;
            }
            const serialized = spans
              .map((span) => JSON.stringify(span))
              .join(",");
            parts.push(isFirstPage ? serialized : `,${serialized}`);
            isFirstPage = false;
          },
        });
        parts.push("]}]}]}");
        downloadBlob({
          fileName: fullFileName,
          parts,
          type: "application/json",
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
                        JSONL has one span per line. OTLP JSON uses the
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
