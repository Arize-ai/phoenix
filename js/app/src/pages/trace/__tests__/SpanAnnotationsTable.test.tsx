import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";

import { SpanAnnotationsTable } from "../SpanAnnotationsTable";

// Deletion has its own viewer/mutation dependencies, unrelated to rendering
// the explanation column. The query, table, cells and PrettyText remain real.
vi.mock("@phoenix/components/trace/SpanAnnotationDeleteButton", () => ({
  SpanAnnotationDeleteButton: () => null,
}));

installTestMatchMedia();
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SpanAnnotationsTable explanations", () => {
  it("updates the explanation renderer when row expansion changes", async () => {
    const explanation = '{"reason":"grounded","scores":[1,2]}';
    const environment = new Environment({
      network: Network.create(async () => ({
        data: {
          span: {
            __typename: "Span",
            id: "U3Bhbjox",
            spanAnnotations: [
              {
                id: "annotation-1",
                name: "quality",
                label: "pass",
                score: 1,
                explanation,
                metadata: null,
                annotatorKind: "LLM",
                identifier: "",
                source: "API",
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
                user: null,
              },
            ],
          },
        },
      })),
      store: new Store(new RecordSource()),
    });
    async function render(areRowsExpanded: boolean) {
      await act(async () => {
        root.render(
          <RelayEnvironmentProvider environment={environment}>
            <ThemeProvider themeMode="light">
              <PreferencesProvider>
                <Suspense>
                  <SpanAnnotationsTable
                    spanNodeId="U3Bhbjox"
                    areRowsExpanded={areRowsExpanded}
                  />
                </Suspense>
              </PreferencesProvider>
            </ThemeProvider>
          </RelayEnvironmentProvider>
        );
      });
    }
    await render(false);
    expect(container.querySelector("pre")?.textContent).toBe(explanation);
    expect(container.querySelector(".cm-editor")).toBeNull();
    await render(true);
    expect(container.querySelector(".pretty-text")?.textContent).toContain(
      '"reason": "grounded"'
    );
    expect(container.querySelector("table")?.dataset.rows).toBe("expanded");
    expect(container.querySelector(".cm-editor, [contenteditable]")).toBeNull();
    await render(false);
    expect(container.querySelector("pre")?.textContent).toBe(explanation);
    expect(container.querySelector(".cm-editor")).toBeNull();
  });
});
