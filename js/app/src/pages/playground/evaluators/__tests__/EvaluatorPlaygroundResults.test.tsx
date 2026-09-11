import { act, type ReactNode, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { EvaluatorPlaygroundResults } from "../results";

// The input/output cells render JSON through CodeMirror, which cannot mount in
// jsdom (its extension instanceof checks fail). Stand in a <pre> that echoes
// the value so the row-content assertions below still see the example text.
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value }: { value: string }) => <pre>{value}</pre>,
  EditorView: {
    lineWrapping: {},
    theme: vi.fn(() => ({})),
    contentAttributes: { of: vi.fn(() => ({})) },
    decorations: { from: vi.fn(() => ({})) },
    updateListener: { of: vi.fn(() => ({})) },
  },
}));

installTestMatchMedia();

const initialProps: ComponentProps<typeof EvaluatorPlaygroundResults> = {
  examples: [
    {
      id: "old-example",
      revisionId: "old-revision",
      input: { question: "Previous dataset question" },
      output: "Previous dataset answer",
      metadata: {},
      calibrationLabels: [],
    },
  ],
  sampleSize: 20,
  isLoading: false,
  runs: {},
  slots: {},
  visibleSlotIds: ["A"],
  expected: {},
  filter: "all",
  onFilterChange: vi.fn(),
  onSaveExpectedOutput: vi.fn(async () => ({ ok: true as const })),
  isRunning: false,
  runnableSlots: ["A"],
  onRunSlot: vi.fn(),
  onRunExample: vi.fn(),
  saveStatus: "idle",
  pendingCount: 0,
  hideExpectedAnnotations: true,
  expectedOutputError: null,
  staleSlots: [],
  onRetryExpectedOutputs: vi.fn(),
  onReloadSample: vi.fn(),
};

describe("results loading snapshot", () => {
  it("keeps the last ready rows inert through consecutive switches and replaces them when ready", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    const render = (node: ReactNode) =>
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          {node}
        </ThemeProvider>
      );

    try {
      act(() =>
        render(
          <EvaluatorPlaygroundResults
            {...initialProps}
            isLoading
            examples={[]}
          />
        )
      );
      expect(container.textContent).not.toContain("Previous results shown");
      act(() => render(<EvaluatorPlaygroundResults {...initialProps} />));
      const originalRow = container.querySelector("tbody tr");
      act(() =>
        render(
          <EvaluatorPlaygroundResults
            {...initialProps}
            isLoading
            examples={[]}
          />
        )
      );
      expect(container.querySelector("tbody tr")).toBe(originalRow);
      expect(container.querySelector("[inert]")).not.toBeNull();
      expect(container.textContent).toContain("Previous results shown");

      const nextExamples = [
        {
          ...initialProps.examples[0],
          id: "next-example",
          revisionId: "next-revision",
          output: "New dataset answer",
        },
      ];

      act(() =>
        render(
          <EvaluatorPlaygroundResults
            {...initialProps}
            isLoading
            examples={nextExamples}
          />
        )
      );
      expect(container.querySelector("tbody tr")).toBe(originalRow);
      expect(container.textContent).not.toContain("New dataset answer");

      act(() =>
        render(
          <EvaluatorPlaygroundResults
            {...initialProps}
            examples={nextExamples}
          />
        )
      );
      expect(container.querySelector("[inert]")).toBeNull();
      expect(container.textContent).toContain("New dataset answer");
      expect(container.textContent).not.toContain("Previous dataset answer");
      expect(container.textContent).not.toContain("Previous results shown");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});

describe("example field columns", () => {
  function renderResults(node: ReactNode) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          {node}
        </ThemeProvider>
      )
    );

    return {
      container,
      unmount: () => {
        act(() => root.unmount());
        container.remove();
      },
    };
  }

  const headers = (container: HTMLElement) =>
    [...container.querySelectorAll("thead th")].map((th) => th.textContent);

  it("hides the metadata column while the sample's metadata is empty", () => {
    const { container, unmount } = renderResults(
      <EvaluatorPlaygroundResults {...initialProps} />
    );

    try {
      expect(headers(container)).toEqual(
        expect.arrayContaining(["Input", "Output"])
      );
      expect(headers(container)).not.toContain("Metadata");
    } finally {
      unmount();
    }
  });

  it("leaves the annotations key out of the metadata cell unless asked", () => {
    const example = {
      ...initialProps.examples[0],
      metadata: {
        customer: "acme",
        annotations: { judge: [{ label: "pass", annotator_kind: "HUMAN" }] },
      },
    };

    const hidden = renderResults(
      <EvaluatorPlaygroundResults {...initialProps} examples={[example]} />
    );

    try {
      const cell = hidden.container.querySelector(
        "td.results-table__example-cell:nth-of-type(4)"
      );

      expect(cell?.textContent).toContain('"customer"');
      expect(cell?.textContent).not.toContain('"annotations"');
      expect(
        hidden.container.querySelector(
          "[aria-label='The \"annotations\" key is hidden in this cell']"
        )
      ).not.toBeNull();
    } finally {
      hidden.unmount();
    }

    const shown = renderResults(
      <EvaluatorPlaygroundResults
        {...initialProps}
        examples={[example]}
        hideExpectedAnnotations={false}
      />
    );

    try {
      expect(shown.container.textContent).toContain('"annotations"');
      expect(
        shown.container.querySelector(
          "[aria-label='The \"annotations\" key is hidden in this cell']"
        )
      ).toBeNull();
    } finally {
      shown.unmount();
    }
  });

  it("shows the metadata column once an example carries metadata", () => {
    const { container, unmount } = renderResults(
      <EvaluatorPlaygroundResults
        {...initialProps}
        examples={[
          { ...initialProps.examples[0], metadata: { customer: "acme" } },
        ]}
      />
    );

    try {
      expect(headers(container)).toContain("Metadata");
      expect(container.textContent).toContain('"customer": "acme"');
    } finally {
      unmount();
    }
  });
});
