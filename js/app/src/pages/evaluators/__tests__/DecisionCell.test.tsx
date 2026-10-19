import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { DecisionCell } from "../DecisionCell";

describe("DecisionCell", () => {
  it("renders nothing without a decision version", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <DecisionCell decisionVersion={null} />
        </MemoryRouter>
      )
    );
    expect(container.innerHTML).toBe("");
    act(() => root.unmount());
  });
});

describe("DecisionCell name", () => {
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

  it("renders the decision name and version number", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() =>
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <MemoryRouter>
            <DecisionCell
              decisionVersion={{
                id: "v1",
                decisionId: "d1",
                sequenceNumber: 3,
                decision: { name: "triage" },
              }}
            />
          </MemoryRouter>
        </ThemeProvider>
      )
    );
    expect(container.textContent).toContain("triage");
    expect(container.textContent).toContain("v3");
    act(() => root.unmount());
  });
});
