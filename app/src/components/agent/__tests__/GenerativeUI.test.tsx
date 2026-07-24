import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GenerativeUI,
  LEGACY_JSON_RENDER_DATA_PART_TYPE,
} from "@phoenix/components/agent/generativeUI";
import { getSpecAndState } from "@phoenix/components/agent/generativeUI/specParts";
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

function renderGenerativeUI(parts: unknown[]) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test fixtures are loose object literals coerced to the GenerativeUI parts union
  const typedParts = parts as Parameters<typeof GenerativeUI>[0]["parts"];
  act(() => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <GenerativeUI parts={typedParts} />
      </ThemeProvider>
    );
  });
}

describe("GenerativeUI", () => {
  it("renders valid generative UI specs", () => {
    renderGenerativeUI([
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

  it("does not attempt to render invalid generative UI specs", () => {
    renderGenerativeUI([
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
      "Generative UI was requested, but no renderable spec was found in the message parts."
    );
  });

  it("renders a skeleton for pending generative UI tool calls", () => {
    renderGenerativeUI([
      {
        type: "tool-render_generative_ui",
        state: "input-streaming",
        input: {
          spec: {
            root: "chart",
            elements: {},
          },
        },
      },
    ]);

    expect(
      container.querySelector('[aria-label="Loading generative UI"]')
    ).toBeTruthy();
    expect(container.textContent).not.toContain(
      "Generative UI was requested, but no renderable spec was found in the message parts."
    );
  });

  it("renders failed generative UI tool calls as tool parts, not generative UI", () => {
    renderGenerativeUI([
      {
        type: "tool-render_generative_ui",
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
      "Generative UI was requested, but no renderable spec was found in the message parts."
    );
  });

  it("keeps legend swatch colors aligned with labeled line series indices", () => {
    renderGenerativeUI([
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
    const swatch = revenueLabel?.previousElementSibling;
    expect(
      swatch instanceof HTMLElement ? swatch.style.background : undefined
    ).toBe("var(--global-color-gray-600)");
  });

  it("renders stacked bar chart specs", () => {
    renderGenerativeUI([
      {
        type: LEGACY_JSON_RENDER_DATA_PART_TYPE,
        data: {
          root: "chart",
          elements: {
            chart: {
              type: "StackedBarChart",
              props: {
                title: "Span Status By Service",
                data: [
                  {
                    label: "api",
                    segments: [
                      { label: "ok", value: 84 },
                      { label: "error", value: 6 },
                    ],
                  },
                  {
                    label: "worker",
                    segments: [
                      { label: "ok", value: 41 },
                      { label: "error", value: 9 },
                    ],
                  },
                ],
              },
              children: [],
            },
          },
        },
      },
    ]);

    expect(container.textContent).toContain("Span Status By Service");
    expect(container.textContent).toContain("worker");
  });

  it("renders completed stacked bar chart tool parts", () => {
    renderGenerativeUI([
      {
        type: "tool-render_generative_ui",
        state: "output-available",
        input: {
          spec: {
            root: "chart3",
            elements: {
              chart3: {
                type: "StackedBarChart",
                props: {
                  title: "Stacked Bar Chart",
                  data: [
                    {
                      label: "Team A",
                      segments: [
                        { label: "Success", value: 18 },
                        { label: "Retry", value: 4 },
                        { label: "Error", value: 2 },
                      ],
                    },
                    {
                      label: "Team B",
                      segments: [
                        { label: "Success", value: 14 },
                        { label: "Retry", value: 6 },
                        { label: "Error", value: 3 },
                      ],
                    },
                    {
                      label: "Team C",
                      segments: [
                        { label: "Success", value: 20 },
                        { label: "Retry", value: 2 },
                        { label: "Error", value: 1 },
                      ],
                    },
                  ],
                },
                children: [],
              },
            },
          },
          state: {},
        },
      },
    ]);

    expect(container.textContent).toContain("Stacked Bar Chart");
    expect(container.textContent).toContain("Team C");
  });

  it("preserves completed tool spec identity after validation", () => {
    const spec = {
      root: "chart",
      elements: {
        chart: {
          type: "StackedBarChart",
          props: {
            title: "Stable Stacked Bar Chart",
            data: [
              {
                label: "Team A",
                segments: [
                  { label: "Success", value: 18 },
                  { label: "Retry", value: 4 },
                ],
              },
              {
                label: "Team B",
                segments: [
                  { label: "Success", value: 14 },
                  { label: "Retry", value: 6 },
                ],
              },
            ],
          },
          children: [],
        },
      },
    };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test fixture is a loose object literal coerced to the getSpecAndState parts union
    const parts = [
      {
        type: "tool-render_generative_ui",
        state: "output-available",
        input: { spec },
      },
    ] as unknown as Parameters<typeof getSpecAndState>[0];

    expect(getSpecAndState(parts).spec).toBe(spec);
    expect(getSpecAndState(parts).spec).toBe(spec);
  });

  it("renders stacked bar chart tool parts with shared segment labels", () => {
    renderGenerativeUI([
      {
        type: "tool-render_generative_ui",
        state: "output-available",
        input: {
          spec: {
            root: "stacked",
            elements: {
              stacked: {
                type: "StackedBarChart",
                props: {
                  title: "Span Kinds by Project",
                  data: [
                    {
                      label: "Chatbot",
                      segments: [
                        { label: "LLM", value: 450 },
                        { label: "Tool", value: 120 },
                        { label: "Chain", value: 300 },
                      ],
                    },
                    {
                      label: "RAG Pipeline",
                      segments: [
                        { label: "LLM", value: 200 },
                        { label: "Retriever", value: 380 },
                        { label: "Chain", value: 150 },
                      ],
                    },
                    {
                      label: "Agent",
                      segments: [
                        { label: "LLM", value: 600 },
                        { label: "Tool", value: 500 },
                        { label: "Chain", value: 250 },
                      ],
                    },
                    {
                      label: "Summarizer",
                      segments: [
                        { label: "LLM", value: 350 },
                        { label: "Tool", value: 40 },
                        { label: "Chain", value: 180 },
                      ],
                    },
                  ],
                },
                children: [],
              },
            },
          },
        },
      },
    ]);

    expect(container.textContent).toContain("Span Kinds by Project");
    expect(container.textContent).toContain("RAG Pipeline");
  });

  it("does not attempt to render generative UI specs with cyclic children", () => {
    renderGenerativeUI([
      {
        type: LEGACY_JSON_RENDER_DATA_PART_TYPE,
        data: {
          root: "chart",
          elements: {
            chart: {
              type: "StackedBarChart",
              props: {
                title: "Span Status By Service",
                data: [
                  {
                    label: "api",
                    segments: [
                      { label: "ok", value: 84 },
                      { label: "error", value: 6 },
                    ],
                  },
                  {
                    label: "worker",
                    segments: [
                      { label: "ok", value: 41 },
                      { label: "error", value: 9 },
                    ],
                  },
                ],
              },
              children: ["chart"],
            },
          },
        },
      },
    ]);

    expect(container.textContent).toContain(
      "Generative UI was requested, but no renderable spec was found in the message parts."
    );
  });

  it("does not attempt to render malformed stacked bar chart tool parts", () => {
    renderGenerativeUI([
      {
        type: "tool-render_generative_ui",
        state: "output-available",
        input: {
          spec: {
            root: "stacked",
            elements: {
              stacked: {
                type: "StackedBarChart",
                props: {
                  title: "Stacked Bar Chart — Token Usage by Model",
                  data: [
                    {
                      label: "gpt-4o",
                      segments: [
                        { label: "Prompt", value: 12500 },
                        { label: "Completion", value: 8200 },
                        {},
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]);

    expect(container.textContent).toContain(
      "Generative UI was requested, but no renderable spec was found in the message parts."
    );
  });
});
