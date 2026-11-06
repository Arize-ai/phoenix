import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { DecisionCell } from "../DecisionCell";
import { PromptLink } from "../PromptCell";

function render(node: ReactNode) {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() =>
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <MemoryRouter>{node}</MemoryRouter>
      </ThemeProvider>
    )
  );
  return {
    container,
    unmount: () => act(() => root.unmount()),
  };
}

const version = {
  id: "v1",
  decisionId: "d1",
  decision: { name: "triage" },
};

describe("DecisionCell", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("renders nothing without a decision version", () => {
    const { container, unmount } = render(
      <DecisionCell decisionVersion={null} />
    );
    expect(container.innerHTML).toBe("");
    unmount();
  });

  it("shows the decision name and the tag, linking to the tagged version", () => {
    const { container, unmount } = render(
      <DecisionCell
        decisionVersion={version}
        decisionVersionTag="triage-evaluator-1a2b3c4d"
      />
    );
    expect(container.textContent).toBe("triage @ triage-evaluator-1a2b3c4d");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/prompts/decisions/d1/versions/v1"
    );
    unmount();
  });

  it("shows latest without a tag, linking to the decision", () => {
    const { container, unmount } = render(
      <DecisionCell decisionVersion={version} />
    );
    expect(container.textContent).toBe("triage @ latest");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/prompts/decisions/d1"
    );
    unmount();
  });

  it.each([
    ["a tag", "qa-evaluator-1a2b3c4d"],
    ["no tag", undefined],
  ])("renders the same markup as a prompt with %s", (_, tag) => {
    const decision = render(
      <DecisionCell decisionVersion={version} decisionVersionTag={tag} />
    );
    const prompt = render(
      <PromptLink promptId="p1" promptName="triage" promptVersionTag={tag} />
    );
    const withoutHref = (html: string) => html.replace(/href="[^"]*"/g, "");
    expect(withoutHref(decision.container.innerHTML)).toBe(
      withoutHref(prompt.container.innerHTML)
    );
    decision.unmount();
    prompt.unmount();
  });
});
