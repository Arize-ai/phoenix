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

const PAGE_SIZE = 1000;

/**
 * Fetches all OTLP spans matching the given span or trace IDs, following
 * pagination cursors until the result set is exhausted.
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
  const spans: OtlpSpan[] = [];
  let cursor: string | null = null;
  do {
    const query: {
      limit: number;
      span_id?: string[];
      trace_id?: string[];
      cursor?: string;
    } = {
      limit: PAGE_SIZE,
      ...(spanIds ? { span_id: spanIds } : {}),
      ...(traceIds ? { trace_id: traceIds } : {}),
      ...(cursor ? { cursor } : {}),
    };
    const { data, error } = await authApiFetch.GET(
      "/v1/projects/{project_identifier}/spans/otlpv1",
      {
        params: {
          path: { project_identifier: projectId },
          query,
        },
      }
    );
    if (error != null || data == null) {
      throw new Error(typeof error === "string" ? error : "request failed");
    }
    spans.push(...data.data);
    cursor = data.next_cursor ?? null;
  } while (cursor);
  return spans;
}

function downloadJson({
  fileName,
  payload,
}: {
  fileName: string;
  payload: unknown;
}) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

type SpanSelectionDownloadMenuProps = {
  projectId: string;
  selectedSpans: SelectedSpan[];
  onError: (message: string) => void;
};

/**
 * A menu that downloads the selected spans, or the full traces they belong
 * to, as an OTLP JSON file.
 */
export function SpanSelectionDownloadMenu({
  projectId,
  selectedSpans,
  onError,
}: SpanSelectionDownloadMenuProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const onDownload = async (kind: "spans" | "traces") => {
    setIsDownloading(true);
    try {
      const spans = await fetchOtlpSpans(
        kind === "spans"
          ? {
              projectId,
              spanIds: [...new Set(selectedSpans.map((span) => span.spanId))],
            }
          : {
              projectId,
              traceIds: [
                ...new Set(selectedSpans.map((span) => span.trace.traceId)),
              ],
            }
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadJson({
        fileName: `${kind}-${timestamp}.json`,
        payload: { resource_spans: [{ scope_spans: [{ spans }] }] },
      });
    } catch (error) {
      onError(
        `Failed to download ${kind}: ${error instanceof Error ? error.message : String(error)}`
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
      <Popover placement="top end">
        <Menu
          onAction={(action) => {
            if (action === "spans" || action === "traces") {
              onDownload(action);
            }
          }}
        >
          <MenuItem id="spans">Download Spans</MenuItem>
          <MenuItem id="traces">Download Traces</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
