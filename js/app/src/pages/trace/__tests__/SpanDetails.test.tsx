import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";

import { SpanDetails } from "../SpanDetails";
import { SpanInfoCardsProvider } from "../SpanInfoCardsContext";

// The panels below the header pull in annotation editors and code blocks that
// have nothing to do with how the project id is resolved
vi.mock("../SpanAside", () => ({
  SpanAside: () => <div data-testid="span-aside" />,
}));
vi.mock("../span", () => ({
  SpanInfo: () => <div data-testid="span-info" />,
  SpanAttributesCard: () => <div data-testid="span-attributes-card" />,
}));
vi.mock("../SpanDownloadMenu", () => ({
  SpanDownloadMenu: ({ projectId }: { projectId: string }) => (
    <div data-testid="span-download-menu" data-project-id={projectId} />
  ),
}));

installTestMatchMedia();
installTestStorage();

const SPAN_NODE_ID = "U3Bhbjox";
const PROJECT_NODE_ID = "UHJvamVjdDox";

// Mirrors the dataset evaluator trace route, which has no `:projectId` segment.
const EVALUATOR_TRACE_ROUTE =
  "/datasets/:datasetId/evaluators/:evaluatorId/:traceId";
const EVALUATOR_TRACE_PATH =
  "/datasets/RGF0YXNldDox/evaluators/RXZhbHVhdG9yOjE/trace-1";

const spanPayload = {
  __typename: "Span",
  id: SPAN_NODE_ID,
  spanId: "0123456789abcdef",
  trace: {
    __typename: "Trace",
    id: "VHJhY2U6MQ==",
    traceId: "trace-1",
  },
  project: {
    __typename: "Project",
    id: PROJECT_NODE_ID,
    annotationConfigs: { configs: [], edges: [] },
  },
  name: "chat completion",
  spanKind: "llm",
  // aliased from `propagatedStatusCode` by SpanDetailsQuery
  statusCode: "OK",
  // aliased from `statusCode` by the SpanHeader_span and SpanAside_span fragments
  code: "OK",
  statusMessage: "",
  startTime: "2026-01-01T00:00:00.000Z",
  endTime: "2026-01-01T00:00:01.000Z",
  parentId: null,
  latencyMs: 1000,
  tokenCountTotal: 42,
  costSummary: { total: { cost: 0.01 } },
  input: { value: "hello", mimeType: "text" },
  output: { value: "world", mimeType: "text" },
  attributes: "{}",
  events: [],
  documentRetrievalMetrics: [],
  documentEvaluations: [],
};

function createTestEnvironment() {
  return new Environment({
    network: Network.create(() =>
      Observable.create((sink) => {
        sink.next({ data: { span: spanPayload } });
        sink.complete();
      })
    ),
    store: new Store(new RecordSource()),
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

async function renderSpanDetails() {
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={createTestEnvironment()}>
        <ThemeProvider themeMode="dark">
          <PreferencesProvider>
            <MemoryRouter initialEntries={[EVALUATOR_TRACE_PATH]}>
              <Routes>
                <Route
                  path={EVALUATOR_TRACE_ROUTE}
                  element={
                    <SpanInfoCardsProvider>
                      <Suspense fallback={<div>loading</div>}>
                        <SpanDetails spanNodeId={SPAN_NODE_ID} />
                      </Suspense>
                    </SpanInfoCardsProvider>
                  }
                />
              </Routes>
            </MemoryRouter>
          </PreferencesProvider>
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });
}

describe("SpanDetails", () => {
  it("renders a span when embedded outside a :projectId route", async () => {
    await renderSpanDetails();

    expect(container.querySelector("[data-testid='span-header-row']")).not.toBe(
      null
    );
    expect(container.textContent).toContain("chat completion");
  });

  it("resolves the download project id from the span rather than the route", async () => {
    await renderSpanDetails();

    const downloadMenu = container.querySelector(
      "[data-testid='span-download-menu']"
    );
    expect(downloadMenu?.getAttribute("data-project-id")).toBe(PROJECT_NODE_ID);
  });
});
