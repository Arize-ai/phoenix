import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts";

import { AnnotationDetailsList } from "../AnnotationDetailsList";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("AnnotationDetailsList", () => {
  it("shows every annotation and classifies each score independently", () => {
    const firstCreatedAt = "2026-08-07T12:00:00.000Z";
    const secondCreatedAt = "2026-08-07T11:00:00.000Z";
    const thirdCreatedAt = "2026-08-07T10:00:00.000Z";

    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <AnnotationDetailsList
            annotations={[
              {
                id: "1",
                name: "quality",
                label: "pass",
                score: 0.9,
                explanation: "Grounded in the supplied context.",
                annotatorKind: "HUMAN",
                createdAt: firstCreatedAt,
                user: { username: "alice" },
              },
              {
                id: "2",
                name: "quality",
                label: "fail",
                score: 0.1,
                explanation: "Misses a required citation.",
                annotatorKind: "LLM",
                createdAt: secondCreatedAt,
                user: null,
              },
              {
                id: "3",
                name: "quality",
                label: null,
                score: null,
                explanation: "Explains the result without assigning a value.",
                annotatorKind: "CODE",
                createdAt: thirdCreatedAt,
                user: { username: "bob" },
              },
            ]}
            annotationConfig={{
              annotationType: "FREEFORM",
              optimizationDirection: "MAXIMIZE",
              threshold: 0.5,
            }}
          />
        </ThemeProvider>
      );
    });

    const rows = container.querySelectorAll("li");
    expect(rows).toHaveLength(3);
    const firstRow = rows.item(0);
    const secondRow = rows.item(1);
    const thirdRow = rows.item(2);
    expect(firstRow.textContent).toContain("pass");
    expect(firstRow.textContent).toContain("Grounded in the supplied context.");
    expect(firstRow.textContent).toContain("HUMAN");
    expect(firstRow.textContent).toContain("alice");
    expect(firstRow.textContent).toContain(
      new Date(firstCreatedAt).toLocaleString()
    );
    expect(secondRow.textContent).toContain("fail");
    expect(secondRow.textContent).toContain("Misses a required citation.");
    expect(secondRow.textContent).toContain("LLM");
    expect(secondRow.textContent).toContain("system");
    expect(secondRow.textContent).toContain(
      new Date(secondCreatedAt).toLocaleString()
    );
    expect(thirdRow.textContent).toContain(
      "Explains the result without assigning a value."
    );
    expect(thirdRow.textContent).toContain("CODE");
    expect(thirdRow.textContent).toContain("bob");
    expect(thirdRow.textContent).toContain(
      new Date(thirdCreatedAt).toLocaleString()
    );
    expect(thirdRow.querySelector("[data-direction]")).toBeNull();

    expect(
      firstRow.querySelector('[data-direction="positive"]')?.textContent
    ).toContain("Favorable score: 0.9");
    expect(
      secondRow.querySelector('[data-direction="negative"]')?.textContent
    ).toContain("Unfavorable score: 0.1");
  });
});
