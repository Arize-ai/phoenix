import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { DocumentAnnotationItem } from "../DocumentAnnotationItem";

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

async function renderExplanation(explanation: string | null | undefined) {
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light">
        <DocumentAnnotationItem
          documentAnnotation={{
            id: "annotation-1",
            name: "relevance",
            label: "relevant",
            score: 1,
            annotatorKind: "LLM",
            documentPosition: 0,
            explanation: explanation ?? null,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            user: null,
          }}
          spanNodeId="span-1"
          documentPosition={0}
          borderColor="default"
          tokenColor={undefined}
          canAnnotate={false}
          editingAnnotation={null}
          existingAnnotationNames={[]}
          nowEpochMs={Date.parse("2026-01-01T00:00:00Z")}
          onEdit={() => {}}
          onSaved={() => {}}
          onCancel={() => {}}
        />
      </ThemeProvider>
    );
  });
}
describe("DocumentAnnotationItem explanations", () => {
  it.each([
    "A plain explanation\nwith a second line",
    '{"invalid":',
    '<img src=x onerror="alert(1)">',
  ])("preserves plain or malformed text safely: %s", async (explanation) => {
    await renderExplanation(explanation);
    expect(container.querySelector(".pretty-text")?.textContent).toBe(
      explanation
    );
    expect(container.querySelector("img[src=x]")).toBeNull();
  });
  it.each([
    '{"reason":"relevant","details":[1,2]}',
    '[{"reason":"ok"}]',
    "null",
    '"a JSON string"',
  ])(
    "renders valid JSON as lossless read-only text: %s",
    async (explanation) => {
      await renderExplanation(explanation);
      expect(container.querySelector(".pretty-text")?.textContent).toBe(
        JSON.stringify(JSON.parse(explanation), null, 2)
      );
      expect(
        container.querySelector(".cm-editor, [contenteditable]")
      ).toBeNull();
    }
  );
  it.each(["", null, undefined])(
    "omits empty explanations: %s",
    async (explanation) => {
      await renderExplanation(explanation);
      expect(container.querySelector(".pretty-text")).toBeNull();
    }
  );
});
