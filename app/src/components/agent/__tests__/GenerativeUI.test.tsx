import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GenerativeUI,
  LEGACY_JSON_RENDER_DATA_PART_TYPE,
} from "@phoenix/components/agent/GenerativeUI";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function renderGeneratedUI(parts: unknown[]) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <GenerativeUI
          parts={parts as Parameters<typeof GenerativeUI>[0]["parts"]}
        />
      </ThemeProvider>
    );
  });
}

describe("GenerativeUI", () => {
  it("renders valid generated UI specs", () => {
    renderGeneratedUI([
      {
        type: LEGACY_JSON_RENDER_DATA_PART_TYPE,
        data: {
          root: "chart",
          elements: {
            chart: {
              type: "BarChart",
              props: {
                title: "Trace Summary",
                data: [
                  { label: "Total spans", value: 42 },
                  { label: "Error spans", value: 3 },
                ],
              },
              children: [],
            },
          },
        },
      },
    ]);

    expect(container.textContent).toContain("Trace Summary");
  });

  it("does not attempt to render invalid generated UI specs", () => {
    renderGeneratedUI([
      {
        type: LEGACY_JSON_RENDER_DATA_PART_TYPE,
        data: {
          root: "chart",
          elements: {
            chart: {
              type: "LineChart",
              props: { title: null, data: null },
              children: [],
            },
          },
        },
      },
    ]);

    expect(container.textContent).toContain(
      "Generated UI was requested, but no renderable spec was found in the message parts."
    );
  });

  it("renders failed generated UI tool calls as tool parts, not generated UI", () => {
    renderGeneratedUI([
      {
        type: "tool-render_generated_ui",
        state: "output-error",
        input: {
          spec: {
            root: "chart",
            elements: {
              chart: {
                type: "LineChart",
                props: { title: null, data: null },
                children: [],
              },
            },
          },
        },
      },
    ]);

    expect(container.textContent).toContain(
      "Generated UI was requested, but no renderable spec was found in the message parts."
    );
  });

  it("keeps legend swatch colors aligned with labeled line series indices", () => {
    renderGeneratedUI([
      {
        type: LEGACY_JSON_RENDER_DATA_PART_TYPE,
        data: {
          root: "chart",
          elements: {
            chart: {
              type: "LineChart",
              props: {
                title: "Trend",
                lines: [
                  { data: [1, 2, 3] },
                  { label: "Revenue", data: [4, 5, 6] },
                ],
                xLabels: ["Mon", "Tue", "Wed"],
              },
              children: [],
            },
          },
        },
      },
    ]);

    const revenueLabel = Array.from(container.querySelectorAll("span")).find(
      (span) => span.textContent === "Revenue"
    );
    expect(revenueLabel).toBeTruthy();
    expect(
      (revenueLabel?.previousElementSibling as HTMLDivElement | null)?.style
        .background
    ).toBe("var(--global-color-gray-600)");
  });
});
