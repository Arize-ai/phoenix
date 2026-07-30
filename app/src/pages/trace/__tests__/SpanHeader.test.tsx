import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import {
  SpanHeaderContent,
  type SpanHeaderData,
} from "@phoenix/pages/SpanHeader";

const BASE_SPAN: SpanHeaderData = {
  code: "ERROR",
  costSummary: null,
  id: "span-node-id",
  latencyMs: null,
  name: "failed span",
  spanId: "span-id",
  spanKind: "llm",
  startTime: "2026-07-28T12:00:00.000Z",
  statusMessage: "",
  tokenCountTotal: null,
};

describe("SpanHeaderContent", () => {
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

  function renderHeader({
    code = "ERROR",
    statusMessage,
  }: {
    code?: SpanHeaderData["code"];
    statusMessage?: string;
  }) {
    act(() => {
      root.render(
        <ThemeProvider>
          <PreferencesProvider>
            <SpanHeaderContent
              span={{ ...BASE_SPAN, code, statusMessage: statusMessage ?? "" }}
            />
          </PreferencesProvider>
        </ThemeProvider>
      );
    });
  }

  it("shows the copyable ID after the title and then the error status", () => {
    renderHeader({ statusMessage: "The model request failed." });

    const title = container.querySelector(".span-header__name");
    const statusMessage = container.querySelector<HTMLElement>(
      ".span-header__status-message"
    );
    const copyIdButton = container.querySelector(
      '[aria-label="Copy Span ID span-id"]'
    );
    expect(title?.nextElementSibling).toBe(copyIdButton);
    expect(copyIdButton?.nextElementSibling).toBe(statusMessage);
    expect(statusMessage?.textContent).toBe("The model request failed.");
    const badge = statusMessage?.querySelector<HTMLElement>(".badge");
    expect(badge?.dataset.variant).toBe("danger");
    expect(getComputedStyle(statusMessage!).flexShrink).toBe("0");
    expect(getComputedStyle(statusMessage!).maxWidth).toBe("40ch");
    expect(getComputedStyle(badge!).maxWidth).toBe("100%");
    expect(getComputedStyle(badge!).textOverflow).toBe("ellipsis");
  });

  it("does not show a status message badge for a non-error span", () => {
    renderHeader({ code: "OK", statusMessage: "Informational message" });

    expect(container.querySelector(".span-header__status-message")).toBeNull();
  });
});
