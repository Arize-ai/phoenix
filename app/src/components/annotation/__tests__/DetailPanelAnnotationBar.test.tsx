import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DetailPanelAnnotationBar } from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import type { AnnotationConfig } from "@phoenix/components/annotation/types";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

const config: AnnotationConfig = {
  id: "config-quality",
  name: "quality",
  description: "Overall response quality",
  annotationType: "CATEGORICAL",
  optimizationDirection: "MAXIMIZE",
  values: [
    { label: "good", score: 1 },
    { label: "bad", score: 0 },
  ],
};

describe("DetailPanelAnnotationBar", () => {
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
    const mutationResult = async () => ({ success: true }) as const;

    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <DetailPanelAnnotationBar
            allAnnotationConfigs={[config]}
            projectAnnotationConfigs={[config]}
            rows={[
              {
                id: "span-1",
                kind: "target",
                target: {
                  id: "span-1",
                  kind: "span",
                  label: "Span",
                  annotations: [
                    {
                      id: "annotation-1",
                      name: "quality",
                      label: "good",
                      score: 1,
                    },
                  ],
                },
              },
            ]}
            onAddAnnotationConfigToProject={mutationResult}
            onCreateAnnotation={mutationResult}
            onCreateAnnotationConfig={mutationResult}
            onDeleteAnnotation={mutationResult}
            onRemoveAnnotationConfigFromProject={mutationResult}
            onUpdateAnnotation={mutationResult}
            onUpdateAnnotationConfig={mutationResult}
          />
        </ThemeProvider>
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    {
      name: "an outside press",
      dismiss: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(document.body);
      },
    },
    {
      name: "the trigger",
      dismiss: async (user: ReturnType<typeof userEvent.setup>) => {
        const trigger = document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        );
        expect(trigger).not.toBeNull();
        await user.click(trigger!);
      },
    },
  ])(
    "cancels config editing when dismissed with $name",
    async ({ dismiss }) => {
      const user = userEvent.setup();
      const trigger = document.querySelector<HTMLButtonElement>(
        '[aria-label="Open quality annotation"]'
      );
      expect(trigger).not.toBeNull();

      await act(async () => user.click(trigger!));
      const editConfig = document.querySelector<HTMLButtonElement>(
        '[aria-label="Edit quality annotation configuration"]'
      );
      expect(editConfig).not.toBeNull();

      await act(async () => user.click(editConfig!));
      expect(document.body.textContent).toContain("Edit quality");

      await act(async () => dismiss(user));
      await act(async () => user.click(trigger!));

      expect(document.body.textContent).not.toContain("Edit quality");
      expect(
        document.querySelector('[aria-label="Annotation values"]')
      ).not.toBeNull();
    }
  );

  it("cancels config editing with Escape without closing the popover", async () => {
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Open quality annotation"]'
    );
    expect(trigger).not.toBeNull();

    await act(async () => user.click(trigger!));
    const editConfig = document.querySelector<HTMLButtonElement>(
      '[aria-label="Edit quality annotation configuration"]'
    );
    expect(editConfig).not.toBeNull();

    await act(async () => user.click(editConfig!));
    expect(document.body.textContent).toContain("Edit quality");
    const description = document.querySelector<HTMLTextAreaElement>("textarea");
    expect(description?.value).toBe("Overall response quality");
    await act(async () => user.clear(description!));
    await act(async () => user.type(description!, "Unsaved description"));

    await act(async () => user.keyboard("{Escape}"));

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.textContent).not.toContain("Edit quality");
    expect(
      document.querySelector('[aria-label="Annotation values"]')
    ).not.toBeNull();

    const reopenedEditConfig = document.querySelector<HTMLButtonElement>(
      '[aria-label="Edit quality annotation configuration"]'
    );
    await act(async () => user.click(reopenedEditConfig!));
    expect(document.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Overall response quality"
    );
  });
});
