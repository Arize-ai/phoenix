import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { PlaygroundExperimentRunDetailsDialog } from "../PlaygroundExperimentRunDetailsDialog";

const fixture = vi.hoisted(() => ({ error: "" as string | null }));
const copy = vi.hoisted(() => vi.fn());
vi.mock("copy-to-clipboard", () => ({ default: copy }));
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
  copy.mockClear();
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
    expect(container.querySelector(".pretty-text")?.textContent).toBe(error);
    expect(container.querySelector("script")).toBeNull();
  });
  it("renders JSON errors without replacing the dialog's input and reference output", async () => {
    await renderError('{"error":{"code":429,"message":"Try again"}}');
    expect(container.textContent).toContain("Input");
    expect(container.textContent).toContain("Reference Output");
    expect(container.textContent).toContain('"code": 429');
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.querySelector(".pretty-text")?.textContent).toBe(
      JSON.stringify({ error: { code: 429, message: "Try again" } }, null, 2)
    );
    expect(alert?.querySelector(".cm-editor, [contenteditable]")).toBeNull();
  });
  it.each(["", null])(
    "keeps the normal output for empty errors: %s",
    async (error) => {
      await renderError(error);
      expect(container.textContent).toContain('"result": "success"');
      expect(container.querySelector(".pretty-text")).toBeNull();
    }
  );
  it("uses a persistent danger banner immediately after the named dialog header", async () => {
    await renderError("Request failed");
    const dialog = container.querySelector('[role="dialog"]');
    const titleId = dialog?.getAttribute("aria-labelledby");
    expect(document.getElementById(titleId || "")?.textContent).toBe(
      "Experiment Run"
    );
    const header = container.querySelector(".dialog__header");
    const body = header?.nextElementSibling;
    expect(body?.getAttribute("aria-label")).toBe("Experiment run details");
    const alert = body?.firstElementChild;
    expect(alert?.getAttribute("role")).toBe("alert");
    expect(
      alert?.querySelector('[data-variant="danger"][data-banner="true"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Close experiment run"]')
    ).not.toBeNull();
    expect(header?.querySelector('[aria-label="Copy error"]')).not.toBeNull();
  });
  it("does not retain an earlier run's error when rendering normal output", async () => {
    await renderError("Request failed");
    await renderError(null);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[aria-label="Copy error"]')).toBeNull();
    expect(
      container.querySelector('[aria-label="Copy output"]')?.closest("header")
    ).not.toBeNull();
    expect(container.textContent).toContain('"result": "success"');
  });
  it("copies the original error once from the fixed header", async () => {
    const error = '{"code":429,"nested":"{\\\"keep\\\":true}"}';
    await renderError(error);
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="Copy error"]'
    );
    expect(buttons).toHaveLength(1);
    await act(async () => buttons[0].click());
    expect(copy).toHaveBeenCalledWith(error);
  });
  it("copies normal output from the output card header", async () => {
    await renderError(null);
    const button = container.querySelector<HTMLButtonElement>(
      '[aria-label="Copy output"]'
    );
    expect(button?.closest("header")).not.toBeNull();
    await act(async () => button?.click());
    expect(copy).toHaveBeenCalledWith(
      JSON.stringify({ result: "success" }, null, 2)
    );
  });
});
