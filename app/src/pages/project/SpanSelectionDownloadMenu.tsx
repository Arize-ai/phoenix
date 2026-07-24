import { useState } from "react";

import type { components } from "@phoenix/api/__generated__/v1";
import { authApiFetch } from "@phoenix/api/authApiFetch";
import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
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

type DownloadAction = "spans" | "traces" | "spans-otlp" | "traces-otlp";

const DOWNLOAD_ACTIONS: DownloadAction[] = [
  "spans",
  "traces",
  "spans-otlp",
  "traces-otlp",
];

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

type SpanSelectionDownloadMenuProps = {
  projectId: string;
  projectName: string;
  selectedSpans: SelectedSpan[];
  onError: (message: string) => void;
};

/**
 * A menu that downloads the selected spans, or the full traces they belong
 * to, as a JSON or JSONL file.
 */
export function SpanSelectionDownloadMenu({
  projectId,
  projectName,
  selectedSpans,
  onError,
}: SpanSelectionDownloadMenuProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const onDownload = async (action: DownloadAction) => {
    setIsDownloading(true);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePrefix = sanitizeFileName(projectName);
    const spanIds = [...new Set(selectedSpans.map((span) => span.spanId))];
    const traceIds = [
      ...new Set(selectedSpans.map((span) => span.trace.traceId)),
    ];
    try {
      switch (action) {
        case "spans": {
          const spans = await fetchPhoenixSpans({ projectId, spanIds });
          downloadJsonl({
            fileName: `${filePrefix}-spans-${timestamp}.jsonl`,
            records: spans,
          });
          break;
        }
        case "traces": {
          const spans = await fetchPhoenixSpans({ projectId, traceIds });
          downloadJsonl({
            fileName: `${filePrefix}-traces-${timestamp}.jsonl`,
            records: spans,
          });
          break;
        }
        case "spans-otlp": {
          const spans = await fetchOtlpSpans({ projectId, spanIds });
          downloadJson({
            fileName: `${filePrefix}-spans-otlp-${timestamp}.json`,
            payload: { resource_spans: [{ scope_spans: [{ spans }] }] },
          });
          break;
        }
        case "traces-otlp": {
          const spans = await fetchOtlpSpans({ projectId, traceIds });
          downloadJson({
            fileName: `${filePrefix}-traces-otlp-${timestamp}.json`,
            payload: { resource_spans: [{ scope_spans: [{ spans }] }] },
          });
          break;
        }
      }
    } catch (error) {
      onError(
        `Failed to download: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <MenuTrigger>
      <Button
        size="M"
        aria-label="Download selection"
        isDisabled={isDownloading}
        leadingVisual={<Icon svg={<Icons.Download />} />}
      />
      {/* The menu opens above the trigger, so the last items sit closest to it */}
      <Popover placement="top end">
        <Menu
          onAction={(action) => {
            if (DOWNLOAD_ACTIONS.includes(action as DownloadAction)) {
              onDownload(action as DownloadAction);
            }
          }}
        >
          <MenuItem id="spans-otlp">Download Spans OTLP JSON</MenuItem>
          <MenuItem id="traces-otlp">Download Traces OTLP JSON</MenuItem>
          <MenuItem id="spans">Download Spans JSONL</MenuItem>
          <MenuItem id="traces">Download Traces JSONL</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
