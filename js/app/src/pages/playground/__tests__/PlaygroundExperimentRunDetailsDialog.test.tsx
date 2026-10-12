import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { PlaygroundExperimentRunDetailsDialog } from "../PlaygroundExperimentRunDetailsDialog";

const fixture = vi.hoisted(() => ({ error: "" as string | null }));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useLazyLoadQuery: () => ({
    run: {
      error: fixture.error,
      output: { result: "success" },
      example: {
        id: "example-1",
        revision: { input: { question: "test" }, output: { answer: "test" } },
      },
      annotations: { edges: [] },
    },
  }),
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

async function renderError(error: string | null) {
  fixture.error = error;
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light">
        <PlaygroundExperimentRunDetailsDialog runId="run-1" />
      </ThemeProvider>
    );
  });
}
describe("PlaygroundExperimentRunDetailsDialog errors", () => {
  it.each([
    "Request timed out\nPlease retry",
    '{"broken":',
    "<script>alert(1)</script>",
  ])("preserves error text safely: %s", async (error) => {
    await renderError(error);
    expect(container.querySelector("pre")?.textContent).toBe(error);
    expect(container.querySelector("script")).toBeNull();
  });
  it("renders JSON errors without replacing the dialog's input and reference output", async () => {
    await renderError('{"error":{"code":429,"message":"Try again"}}');
    expect(container.textContent).toContain("Input");
    expect(container.textContent).toContain("Reference Output");
    expect(container.textContent).toContain('"code": 429');
    expect(container.querySelectorAll(".cm-editor")).toHaveLength(3);
  });
  it.each(["", null])(
    "keeps the normal output for empty errors: %s",
    async (error) => {
      await renderError(error);
      expect(container.textContent).toContain('"result": "success"');
      expect(container.querySelector("pre")).toBeNull();
    }
  );
});
