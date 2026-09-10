import { act, type ReactNode, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { CalibrationResults } from "../CalibrationResults";

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

const initialProps: ComponentProps<typeof CalibrationResults> = {
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
  onReview: vi.fn(async () => ({ ok: true as const })),
  savingId: null,
  reviewError: null,
  staleSlots: [],
  onRetryReview: vi.fn(),
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
        render(<CalibrationResults {...initialProps} isLoading examples={[]} />)
      );
      expect(container.textContent).not.toContain("Previous results shown");
      act(() => render(<CalibrationResults {...initialProps} />));
      const originalRow = container.querySelector("tbody tr");
      act(() =>
        render(<CalibrationResults {...initialProps} isLoading examples={[]} />)
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
          <CalibrationResults
            {...initialProps}
            isLoading
            examples={nextExamples}
          />
        )
      );
      expect(container.querySelector("tbody tr")).toBe(originalRow);
      expect(container.textContent).not.toContain("New dataset answer");

      act(() =>
        render(<CalibrationResults {...initialProps} examples={nextExamples} />)
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
