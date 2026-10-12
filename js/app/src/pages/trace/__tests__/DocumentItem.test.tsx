import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { MarkdownDisplayProvider } from "@phoenix/components/markdown";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";

import { DocumentItem } from "../DocumentItem";

const copy = vi.hoisted(() => vi.fn());
vi.mock("copy-to-clipboard", () => ({ default: copy }));
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

describe("DocumentItem source copy", () => {
  it("copies original document content, never an expanded annotation preview", async () => {
    const content = JSON.stringify({
      payload: JSON.stringify({ reasons: ["supported", "complete"], score: 1 }),
    });
    await act(async () =>
      root.render(
        <ThemeProvider themeMode="light">
          <PreferencesProvider>
            <MarkdownDisplayProvider>
              <DocumentItem document={{ id: "doc-1", content }} />
            </MarkdownDisplayProvider>
          </PreferencesProvider>
        </ThemeProvider>
      )
    );
    const button = container.querySelector<HTMLButtonElement>(
      "header button.copy-button"
    );
    expect(button).not.toBeNull();
    await act(async () => button?.click());
    expect(copy).toHaveBeenCalledWith(content);
    expect(typeof JSON.parse(copy.mock.calls[0][0]).payload).toBe("string");
  });
  it("keeps the full source-document fallback for documents with no content", async () => {
    const document = {
      id: "doc-1",
      metadata: JSON.stringify({
        payload: JSON.stringify({ score: 1, values: ["kept"] }),
      }),
    };
    await act(async () =>
      root.render(
        <ThemeProvider themeMode="light">
          <PreferencesProvider>
            <MarkdownDisplayProvider>
              <DocumentItem document={document} />
            </MarkdownDisplayProvider>
          </PreferencesProvider>
        </ThemeProvider>
      )
    );
    const button = container.querySelector<HTMLButtonElement>(
      "header button.copy-button"
    );
    await act(async () => button?.click());
    expect(copy).toHaveBeenCalledWith(JSON.stringify(document, null, 2));
  });
});
