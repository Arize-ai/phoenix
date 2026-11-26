import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRAFT_SESSION_ID } from "@phoenix/store/agentStore";

import { HomePage } from "../HomePage";

const setIsOpen = vi.fn();
const setActiveSession = vi.fn();
const setPendingMessage = vi.fn();

vi.mock("@phoenix/components/agent/PxiShaderGlyph", () => ({
  PxiShaderGlyph: () => <div data-testid="pxi-glyph" />,
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useLazyLoadQuery: () => ({ agentSessions: { edges: [] } }),
}));

vi.mock("@phoenix/contexts/AgentContext", () => ({
  useAgentContext: (selector: (state: unknown) => unknown) =>
    selector({
      agentsConfig: { assistantEnabled: true },
      activeSessionId: null,
      setIsOpen,
    }),
  useAgentStore: () => ({
    getState: () => ({ setActiveSession, setPendingMessage }),
  }),
}));

describe("HomePage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the title", () => {
    expect(container.querySelector(".homePage__title")?.textContent).toBe(
      "What can I help you with?"
    );
  });

  it("renders three suggestions", () => {
    expect(container.querySelectorAll(".homePage__suggestion")).toHaveLength(3);
  });

  it("stages the suggestion on the draft session and opens the panel", async () => {
    const suggestion = container.querySelector<HTMLAnchorElement>(
      ".homePage__suggestion"
    );
    await act(async () => {
      suggestion?.click();
    });
    expect(setActiveSession).toHaveBeenCalledWith(DRAFT_SESSION_ID);
    expect(setPendingMessage).toHaveBeenCalledWith(DRAFT_SESSION_ID, {
      text: "How do I use Phoenix?",
      requestedSkills: [],
    });
    expect(setIsOpen).toHaveBeenCalledWith(true);
  });

  it("does not submit when the input is empty", async () => {
    const send = container.querySelector<HTMLDivElement>(
      ".home-page-input__send"
    );
    await act(async () => {
      send?.click();
    });
    expect(setPendingMessage).not.toHaveBeenCalled();
  });
});
