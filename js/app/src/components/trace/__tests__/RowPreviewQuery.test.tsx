import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import type { SpanMetricsDetailsQuery as SpanMetricsDetailsQueryType } from "../__generated__/SpanMetricsDetailsQuery.graphql";
import { RowPreviewCard } from "../RowPreviewCard";
import { RowPreviewQuery } from "../RowPreviewQuery";
import { SpanMetricsDetailsQuery } from "../SpanMetricsDetails";

vi.mock("@phoenix/utils/reportClientError", () => ({
  reportClientError: vi.fn(),
}));

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function Preview({
  totals,
}: {
  totals: { tokens: number; cost: number | null };
}) {
  return (
    <RowPreviewQuery<SpanMetricsDetailsQueryType>
      query={SpanMetricsDetailsQuery}
      variables={{ nodeId: "span-1" }}
      placeholder={(metricsError) => (
        <RowPreviewCard
          header="draft_answer"
          timing={{
            startTime: "2026-10-27T15:04:12.000Z",
            endTime: "2026-10-27T15:04:15.000Z",
            latencyMs: 3000,
          }}
          totals={totals}
          metricsError={metricsError}
        >
          hallucination
        </RowPreviewCard>
      )}
    >
      {() => "details loaded"}
    </RowPreviewQuery>
  );
}

async function renderFailedPreview(totals: {
  tokens: number;
  cost: number | null;
}) {
  const environment = createMockEnvironment();
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <ThemeProvider themeMode="dark">
          <PreferencesProvider>
            <Preview totals={totals} />
          </PreferencesProvider>
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });
  // The query starts only once the preview has settled
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  await act(async () => {
    environment.mock.rejectMostRecentOperation(new Error("Failed to fetch"));
  });
}

describe("RowPreviewQuery", () => {
  it("keeps the rest of the preview when its details fail to load", async () => {
    await renderFailedPreview({ tokens: 4821, cost: 0.0212 });
    const text = container.textContent ?? "";
    expect(text).toContain("draft_answer");
    expect(text).toContain("hallucination");
    expect(text).toContain("Tokens and cost");
    expect(text).toContain("error");
    expect(text).not.toContain("details loaded");
  });

  it("names only the measures the row's totals hold", async () => {
    await renderFailedPreview({ tokens: 812, cost: null });
    const text = container.textContent ?? "";
    expect(text).toContain("Tokens");
    expect(text).not.toContain("Tokens and cost");
    expect(text).toContain("error");
  });
});
