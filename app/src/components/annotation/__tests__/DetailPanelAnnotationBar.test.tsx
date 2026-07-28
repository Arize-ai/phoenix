import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DetailPanelAnnotationBar } from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import type { DetailPanelAnnotationBarProps } from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import type {
  Annotation,
  AnnotationConfig,
} from "@phoenix/components/annotation/types";
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

const mutationResult = async () => ({ success: true }) as const;
const createMutationResult = async () =>
  ({
    success: true,
    annotation: {
      id: "annotation-created",
      name: "quality",
      label: "good",
      score: 1,
    },
  }) as const;

describe("DetailPanelAnnotationBar", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderAnnotationBar = ({
    allAnnotationConfigs = [config],
    projectAnnotationConfigs = [config],
    onCreateAnnotationConfig = mutationResult,
    onCreateAnnotation = createMutationResult,
    onDeleteAnnotation = mutationResult,
    onUpdateAnnotation = mutationResult,
    annotations = [
      {
        id: "annotation-1",
        name: "quality",
        label: "good",
        score: 1,
      },
    ],
  }: {
    allAnnotationConfigs?: AnnotationConfig[];
    projectAnnotationConfigs?: AnnotationConfig[];
    onCreateAnnotationConfig?: DetailPanelAnnotationBarProps["onCreateAnnotationConfig"];
    onCreateAnnotation?: DetailPanelAnnotationBarProps["onCreateAnnotation"];
    onDeleteAnnotation?: DetailPanelAnnotationBarProps["onDeleteAnnotation"];
    onUpdateAnnotation?: DetailPanelAnnotationBarProps["onUpdateAnnotation"];
    annotations?: Annotation[];
  } = {}) => {
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <MemoryRouter>
            <DetailPanelAnnotationBar
              allAnnotationConfigs={allAnnotationConfigs}
              projectAnnotationConfigs={projectAnnotationConfigs}
              rows={[
                {
                  id: "span-1",
                  kind: "target",
                  target: {
                    id: "span-1",
                    kind: "span",
                    label: "Span",
                    annotations,
                  },
                },
              ]}
              onAddAnnotationConfigToProject={mutationResult}
              onCreateAnnotation={onCreateAnnotation}
              onCreateAnnotationConfig={onCreateAnnotationConfig}
              onDeleteAnnotation={onDeleteAnnotation}
              onRemoveAnnotationConfigFromProject={mutationResult}
              onUpdateAnnotation={onUpdateAnnotation}
              onUpdateAnnotationConfig={mutationResult}
            />
          </MemoryRouter>
        </ThemeProvider>
      );
    });
  };

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
    renderAnnotationBar();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders populated annotations before unpopulated annotations", () => {
    const helpfulnessConfig = {
      ...config,
      id: "config-helpfulness",
      name: "helpfulness",
    };
    const correctnessConfig = {
      ...config,
      id: "config-correctness",
      name: "correctness",
    };
    const relevanceConfig = {
      ...config,
      id: "config-relevance",
      name: "relevance",
    };
    renderAnnotationBar({
      allAnnotationConfigs: [
        helpfulnessConfig,
        correctnessConfig,
        relevanceConfig,
        config,
      ],
      projectAnnotationConfigs: [
        helpfulnessConfig,
        correctnessConfig,
        relevanceConfig,
        config,
      ],
      annotations: [
        {
          id: "annotation-correctness",
          name: "correctness",
          label: "good",
          score: 1,
        },
        {
          id: "annotation-quality",
          name: "quality",
          label: "good",
          score: 1,
        },
      ],
    });

    expect(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          'button[aria-label^="Open "][aria-label$=" annotation"]'
        )
      ).map((button) => button.getAttribute("aria-label"))
    ).toEqual([
      "Open correctness annotation",
      "Open quality annotation",
      "Open helpfulness annotation",
      "Open relevance annotation",
    ]);
  });

  it("grades saved scores in the annotation label and summary popover", async () => {
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Open quality annotation"]'
    );
    const labelScore = trigger?.querySelector('[data-value-kind="score"]');

    expect(labelScore?.textContent).toBe("1.00");
    expect(labelScore?.getAttribute("data-direction")).toBe("positive");
    expect(labelScore?.getAttribute("data-optimization-value")).toBe("1");
    expect(labelScore?.getAttribute("data-appearance")).toBe("compact");
    expect(
      trigger
        ?.querySelector('[data-value-kind="label"]')
        ?.getAttribute("data-direction")
    ).toBeNull();

    await act(async () => user.click(trigger!));

    const summaryScore = document
      .querySelector('[aria-label="Annotation values"]')
      ?.querySelector('[data-direction="positive"]');
    expect(summaryScore?.textContent).toBe("1.00");
    expect(summaryScore?.getAttribute("data-optimization-value")).toBe("1");
    expect(summaryScore?.getAttribute("data-appearance")).toBe("badge");
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
      expect(document.body.textContent).toContain("categorical");
      const typeLabel = Array.from(document.querySelectorAll("span")).find(
        (element) => element.textContent === "categorical"
      );
      expect(
        typeLabel?.closest('[data-testid="dialog-title-extra"]')
      ).toBeNull();

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

  it("creates an annotation config using the filtered name", async () => {
    const onCreateAnnotationConfig = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotationConfig"]>()
      .mockResolvedValue({ success: true });
    renderAnnotationBar({ onCreateAnnotationConfig });
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add annotation"]'
    );
    expect(trigger).not.toBeNull();

    await act(async () => user.click(trigger!));
    const search = document.querySelector<HTMLInputElement>(
      'input[placeholder="Filter annotations"]'
    );
    await act(async () => user.type(search!, "he"));
    expect(
      Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === "Create “he”"
      )
    ).toBeUndefined();

    await act(async () => user.type(search!, "l"));
    expect(
      Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === "Create “hel”"
      )
    ).not.toBeUndefined();

    await act(async () => user.type(search!, "pfulness"));

    expect(document.body.textContent).toContain("No matching annotations");
    expect(document.querySelector('svg[height="140"]')).not.toBeNull();
    const createFromSearch = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Create “helpfulness”");
    expect(createFromSearch).not.toBeUndefined();

    await act(async () => user.click(createFromSearch!));

    expect(document.body.textContent).toContain("Add annotation configuration");
    expect(document.querySelector<HTMLInputElement>("input")?.value).toBe(
      "helpfulness"
    );
    const save = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save");
    await act(async () => user.click(save!));

    expect(onCreateAnnotationConfig).toHaveBeenCalledWith({
      annotationType: "CATEGORICAL",
      description: null,
      id: "",
      name: "helpfulness",
      optimizationDirection: "MAXIMIZE",
      values: [
        { label: "positive", score: 1 },
        { label: "negative", score: 0 },
      ],
    });
  });

  it("clears the menu search before Escape dismisses the menu", async () => {
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add annotation"]'
    );
    expect(trigger).not.toBeNull();

    await act(async () => user.click(trigger!));
    const search = document.querySelector<HTMLInputElement>(
      'input[placeholder="Filter annotations"]'
    );
    expect(search).not.toBeNull();
    await act(async () => user.type(search!, "helpfulness"));

    await act(async () => user.keyboard("{Escape}"));

    expect(search?.value).toBe("");
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");

    await act(async () => user.keyboard("{Escape}"));

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(
      document.querySelector('input[placeholder="Filter annotations"]')
    ).toBeNull();
  });

  it("creates a categorical annotation directly from a ghost label", async () => {
    const onCreateAnnotation = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotation"]>()
      .mockResolvedValue({
        success: true,
        annotation: {
          id: "annotation-created",
          name: "quality",
          label: "good",
          score: 1,
          explanation: null,
          metadata: {},
          annotatorKind: "HUMAN",
          source: "APP",
        },
      });
    renderAnnotationBar({ annotations: [], onCreateAnnotation });
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Open quality annotation"]'
    );
    expect(trigger?.dataset.variant).toBe("ghost");

    await act(async () => user.click(trigger!));

    const choices = document.querySelector('[aria-label="quality values"]');
    expect(choices).not.toBeNull();
    expect(
      Array.from(choices?.querySelectorAll("li") ?? []).map((option) =>
        option.textContent?.trim()
      )
    ).toEqual(["good1.00Explain", "bad0.00Explain"]);
    expect(document.body.textContent).not.toContain("Explanation");
    expect(document.body.textContent).not.toContain("Cancel");
    expect(document.body.textContent).not.toContain("Save annotation");

    const goodChoice = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add good"]'
    );
    const badChoice = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add bad"]'
    );
    expect(
      goodChoice?.querySelector('[data-direction="positive"]')?.textContent
    ).toBe("1.00");
    expect(
      goodChoice
        ?.querySelector('[data-direction="positive"]')
        ?.getAttribute("data-optimization-value")
    ).toBe("1");
    expect(
      badChoice?.querySelector('[data-direction="negative"]')?.textContent
    ).toBe("0.00");
    expect(
      badChoice
        ?.querySelector('[data-direction="negative"]')
        ?.getAttribute("data-optimization-value")
    ).toBe("-1");
    await act(async () => user.click(goodChoice!));

    expect(onCreateAnnotation).toHaveBeenCalledWith({
      annotationName: "quality",
      target: expect.objectContaining({ id: "span-1", kind: "span" }),
      value: {
        annotatorKind: "HUMAN",
        explanation: "",
        label: "good",
        metadata: {},
        score: 1,
        source: "APP",
      },
    });
    expect(trigger?.dataset.variant).toBe("default");
    expect(trigger?.textContent).toContain("good");
    expect(document.querySelector('[aria-label="quality values"]')).toBeNull();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(
      document.querySelector('[aria-label="Annotation values"]')
    ).toBeNull();
  });

  it("renders the optimization midpoint as neutral and nearby scores gradually", async () => {
    const gradientConfig: AnnotationConfig = {
      ...config,
      values: [
        { label: "low", score: 0 },
        { label: "midpoint", score: 0.5 },
        { label: "slightly high", score: 0.51 },
        { label: "high", score: 1 },
      ],
    };
    renderAnnotationBar({
      allAnnotationConfigs: [gradientConfig],
      projectAnnotationConfigs: [gradientConfig],
      annotations: [],
    });
    const user = userEvent.setup();
    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );

    const midpointScore = document
      .querySelector('[aria-label="Add midpoint"]')
      ?.querySelector('[data-direction="neutral"]');
    const slightlyHighScore = document
      .querySelector('[aria-label="Add slightly high"]')
      ?.querySelector('[data-direction="positive"]');
    expect(midpointScore?.getAttribute("data-optimization-value")).toBe("0");
    expect(
      Number(slightlyHighScore?.getAttribute("data-optimization-value"))
    ).toBeCloseTo(0.02);
    expect(
      getComputedStyle(slightlyHighScore!).getPropertyValue(
        "--annotation-score-foreground-color"
      )
    ).toContain("--global-text-color-700");
  });

  it("does not carry a locally created value to a renamed config", async () => {
    const createdAnnotation: Annotation = {
      id: "annotation-created",
      name: "quality",
      label: "good",
      score: 1,
    };
    const onCreateAnnotation = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotation"]>()
      .mockResolvedValue({ success: true, annotation: createdAnnotation });
    renderAnnotationBar({ annotations: [], onCreateAnnotation });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );
    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>('[aria-label="Add good"]')!
      )
    );

    const renamedConfig = { ...config, name: "quality-review" };
    renderAnnotationBar({
      allAnnotationConfigs: [renamedConfig],
      projectAnnotationConfigs: [renamedConfig],
      annotations: [createdAnnotation],
      onCreateAnnotation,
    });

    const originalAnnotation = document.querySelector<HTMLButtonElement>(
      '[aria-label="Open quality annotation"]'
    );
    const renamedAnnotation = document.querySelector<HTMLButtonElement>(
      '[aria-label="Open quality-review annotation"]'
    );
    expect(originalAnnotation?.dataset.variant).toBe("default");
    expect(originalAnnotation?.textContent).toContain("1.00");
    expect(renamedAnnotation?.dataset.variant).toBe("ghost");
    expect(renamedAnnotation?.textContent).not.toContain("1.00");
  });

  it("creates a freeform annotation with the standard save action", async () => {
    const freeformConfig: AnnotationConfig = {
      id: "config-observation",
      name: "observation",
      description: "Freeform reviewer feedback",
      annotationType: "FREEFORM",
      optimizationDirection: "NONE",
    };
    const onCreateAnnotation = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotation"]>()
      .mockResolvedValue({
        success: true,
        annotation: {
          id: "annotation-created",
          name: "observation",
          label: "Needs a clearer conclusion",
          score: null,
        },
      });
    renderAnnotationBar({
      allAnnotationConfigs: [freeformConfig],
      projectAnnotationConfigs: [freeformConfig],
      annotations: [],
      onCreateAnnotation,
    });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open observation annotation"]'
        )!
      )
    );

    const valueInput = document.querySelector<HTMLInputElement>(
      '[aria-label="observation value"]'
    );
    const addTitle = document.querySelector('[data-testid="dialog-title"]');
    const saveAnnotation = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save annotation");
    expect(addTitle?.textContent).toBe("Add Annotation");
    expect(addTitle?.getAttribute("data-level")).toBe("2");
    expect(valueInput).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Submit annotation"]')
    ).toBeNull();
    expect(saveAnnotation?.closest(".dialog__footer")).not.toBeNull();
    expect(saveAnnotation?.disabled).toBe(true);

    await act(async () => user.type(valueInput!, "Needs a clearer conclusion"));
    expect(saveAnnotation?.disabled).toBe(false);
    expect(saveAnnotation?.dataset.variant).toBe("primary");
    await act(async () => user.click(saveAnnotation!));

    expect(onCreateAnnotation).toHaveBeenCalledWith({
      annotationName: "observation",
      target: expect.objectContaining({ id: "span-1", kind: "span" }),
      value: {
        annotatorKind: "HUMAN",
        explanation: "",
        label: "Needs a clearer conclusion",
        metadata: {},
        score: null,
        source: "APP",
      },
    });
  });

  it("creates a categorical annotation and opens its explanation editor", async () => {
    const createdAnnotation: Annotation = {
      id: "annotation-created",
      name: "quality",
      label: "good",
      score: 1,
      explanation: null,
      metadata: {},
      annotatorKind: "HUMAN",
      source: "APP",
    };
    const onCreateAnnotation = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotation"]>()
      .mockResolvedValue({ success: true, annotation: createdAnnotation });
    const onUpdateAnnotation = vi
      .fn<DetailPanelAnnotationBarProps["onUpdateAnnotation"]>()
      .mockResolvedValue({ success: true });
    renderAnnotationBar({
      annotations: [],
      onCreateAnnotation,
      onUpdateAnnotation,
    });
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Open quality annotation"]'
    );

    await act(async () => user.click(trigger!));
    const explain = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add good and explain"]'
    );
    const value = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add good"]'
    );
    expect(explain?.closest("li")).toBe(value?.closest("li"));
    await act(async () => user.click(explain!));

    expect(onCreateAnnotation).not.toHaveBeenCalled();
    const explanation = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="Why did you choose this value?"]'
    );
    expect(explanation).not.toBeNull();
    expect(document.activeElement).toBe(explanation);

    let saveAnnotation = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save annotation");
    expect(saveAnnotation?.disabled).toBe(false);

    await act(async () => user.keyboard("{Escape}"));

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(
      document.querySelector('[aria-label="quality values"]')
    ).not.toBeNull();
    expect(onCreateAnnotation).not.toHaveBeenCalled();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Add good and explain"]'
        )!
      )
    );
    const reopenedExplanation = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="Why did you choose this value?"]'
    );
    saveAnnotation = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save annotation");
    expect(saveAnnotation?.disabled).toBe(false);
    await act(async () =>
      user.type(reopenedExplanation!, "It met the rubric.")
    );
    await act(async () => user.click(saveAnnotation!));

    expect(onCreateAnnotation).toHaveBeenCalledWith({
      annotationName: "quality",
      target: expect.objectContaining({ id: "span-1", kind: "span" }),
      value: expect.objectContaining({
        explanation: "It met the rubric.",
        label: "good",
        score: 1,
      }),
    });
    expect(onUpdateAnnotation).not.toHaveBeenCalled();
    expect(
      document.querySelector('[aria-label="Annotation values"]')
    ).not.toBeNull();
  });

  it("edits a categorical annotation with a single-selection menu", async () => {
    const onUpdateAnnotation = vi
      .fn<DetailPanelAnnotationBarProps["onUpdateAnnotation"]>()
      .mockResolvedValue({ success: true });
    renderAnnotationBar({ onUpdateAnnotation });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );
    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Edit annotation"]'
        )!
      )
    );

    const selectionField = document.querySelector(
      ".annotation-value-editor__selection"
    );
    const selectionLabel = selectionField?.querySelector("label");
    const choices = selectionField?.querySelector('[role="menu"]');
    expect(selectionLabel?.textContent).toBe("Selection");
    expect(choices?.getAttribute("aria-labelledby")).toBe(selectionLabel?.id);
    const menuItems = Array.from(
      choices?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []
    );
    const goodChoice = menuItems.find((menuItem) =>
      menuItem.textContent?.includes("good")
    );
    const badChoice = menuItems.find((menuItem) =>
      menuItem.textContent?.includes("bad")
    );
    expect(goodChoice?.hasAttribute("data-selected")).toBe(true);
    expect(goodChoice?.querySelector("svg")).not.toBeNull();
    expect(badChoice?.hasAttribute("data-selected")).toBe(false);

    expect(document.body.textContent).toContain("Edit Annotation");
    const saveAnnotation = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save annotation");
    const explanation = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="Why did you choose this value?"]'
    );
    expect(explanation).not.toBeNull();
    await act(async () => user.type(explanation!, "temporary explanation"));
    expect(saveAnnotation?.disabled).toBe(false);
    await act(async () => user.clear(explanation!));
    expect(saveAnnotation?.disabled).toBe(true);

    await act(async () => user.click(badChoice!));
    expect(badChoice?.hasAttribute("data-selected")).toBe(true);
    expect(saveAnnotation?.disabled).toBe(false);
    await act(async () => user.click(saveAnnotation!));

    expect(onUpdateAnnotation).toHaveBeenCalledWith({
      annotation: expect.objectContaining({ id: "annotation-1" }),
      target: expect.objectContaining({ id: "span-1", kind: "span" }),
      value: expect.objectContaining({ label: "bad", score: 0 }),
    });
  });

  it("confirms deletion in place while dimming the explanation", async () => {
    renderAnnotationBar({
      annotations: [
        {
          id: "annotation-1",
          name: "quality",
          label: "good",
          score: 1,
          explanation: "It met the rubric.",
        },
      ],
    });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );
    const annotationEntry = document.querySelector(".annotation-entry");
    const annotationHeader = annotationEntry?.querySelector(
      ":scope > .annotation-entry__header"
    );
    const annotationActions = annotationHeader?.querySelector(
      ":scope > .annotation-entry__actions"
    );
    const deleteAnnotationButton =
      annotationActions?.querySelector<HTMLButtonElement>(
        '[aria-label="Delete annotation"]'
      );
    expect(deleteAnnotationButton?.dataset.variant).toBe("danger");
    await act(async () => user.hover(deleteAnnotationButton!));
    expect(
      getComputedStyle(deleteAnnotationButton!).backgroundColor.replace(
        /\s/g,
        ""
      )
    ).toBe("var(--global-icon-button-danger-background-color-hover)");
    await act(async () => user.click(deleteAnnotationButton!));

    expect(
      annotationHeader?.querySelector(":scope > .annotation-entry__value")
        ?.textContent
    ).toBe("Confirm");
    const confirmationButtons = Array.from(
      annotationActions?.querySelectorAll<HTMLButtonElement>("button") ?? []
    );
    expect(confirmationButtons.map((button) => button.textContent)).toEqual([
      "Cancel",
      "Delete",
    ]);
    expect(confirmationButtons.map((button) => button.dataset.variant)).toEqual(
      ["quiet", "quiet-danger"]
    );
    await act(async () => user.hover(confirmationButtons[1]!));
    expect(
      getComputedStyle(confirmationButtons[1]!).backgroundColor.replace(
        /\s/g,
        ""
      )
    ).toBe("var(--global-button-quiet-danger-background-color-hover)");
    expect(
      annotationActions?.classList.contains(
        "annotation-entry__actions--deleting"
      )
    ).toBe(true);
    const explanation = annotationEntry?.querySelector<HTMLElement>(
      ":scope > .annotation-entry__explanation"
    );
    expect(
      explanation?.classList.contains("annotation-entry__explanation--deleting")
    ).toBe(true);
    expect(getComputedStyle(explanation!).opacity).toBe("0.2");

    await act(async () =>
      user.click(
        Array.from(
          annotationActions?.querySelectorAll<HTMLButtonElement>("button") ?? []
        ).find((button) => button.textContent === "Cancel")!
      )
    );

    expect(
      annotationHeader?.querySelector(":scope > .annotation-entry__value")
        ?.textContent
    ).toBe("1.00good");
    expect(
      explanation?.classList.contains("annotation-entry__explanation--deleting")
    ).toBe(false);
  });

  it("closes the popover when deleting the last annotation", async () => {
    const onDeleteAnnotation = vi
      .fn<DetailPanelAnnotationBarProps["onDeleteAnnotation"]>()
      .mockResolvedValue({ success: true });
    renderAnnotationBar({ onDeleteAnnotation });
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Open quality annotation"]'
    );

    await act(async () => user.click(trigger!));
    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Delete annotation"]'
        )!
      )
    );
    const confirmDelete = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Delete");
    await act(async () => user.click(confirmDelete!));

    expect(onDeleteAnnotation).toHaveBeenCalledWith({
      annotation: expect.objectContaining({ id: "annotation-1" }),
      target: expect.objectContaining({ id: "span-1", kind: "span" }),
    });
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(
      document.querySelector('[aria-label="Annotation values"]')
    ).toBeNull();

    renderAnnotationBar({ annotations: [], onDeleteAnnotation });

    expect(trigger?.dataset.variant).toBe("ghost");
  });

  it("creates an inferred config for annotations with a missing config", async () => {
    const onCreateAnnotationConfig = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotationConfig"]>()
      .mockResolvedValue({ success: true });
    const onUpdateAnnotation = vi
      .fn<DetailPanelAnnotationBarProps["onUpdateAnnotation"]>()
      .mockResolvedValue({ success: true });
    renderAnnotationBar({
      allAnnotationConfigs: [],
      projectAnnotationConfigs: [],
      onCreateAnnotationConfig,
      onUpdateAnnotation,
      annotations: [
        {
          id: "annotation-tool-count",
          name: "tool_count_per_turn",
          label: null,
          score: 3,
          explanation: "3 top-level PXI tool calls in this turn",
          metadata: { toolNames: ["search"] },
          annotatorKind: "CODE",
          source: "API",
          user: {
            username: "alice",
            profilePictureUrl: "/alice.png",
          },
        },
      ],
    });
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Open tool_count_per_turn annotation"]'
    );
    expect(trigger).not.toBeNull();

    await act(async () => user.click(trigger!));

    expect(document.body.textContent).toContain("Missing config");
    expect(document.body.textContent).not.toContain("freeform");
    const statusLabel = Array.from(document.querySelectorAll("span")).find(
      (element) => element.textContent === "Missing config"
    );
    expect(statusLabel?.parentElement?.querySelector("svg")).not.toBeNull();
    expect(
      statusLabel?.closest('[data-testid="dialog-title-extra"]')
    ).not.toBeNull();
    expect(
      document.querySelector(
        '[aria-label="Edit tool_count_per_turn annotation configuration"]'
      )
    ).toBeNull();
    const annotationEntry = document.querySelector(".annotation-entry");
    const annotationHeader = annotationEntry?.querySelector(
      ":scope > .annotation-entry__header"
    );
    const annotationActions = annotationHeader?.querySelector(
      ".annotation-entry__actions"
    );
    expect(annotationHeader).not.toBeNull();
    expect(annotationActions).not.toBeNull();
    expect(
      Array.from(annotationActions?.querySelectorAll("button") ?? []).map(
        (button) => button.getAttribute("data-size")
      )
    ).toEqual(["S", "S"]);
    const explanation = annotationEntry?.querySelector(
      ":scope > .annotation-entry__explanation"
    );
    expect(explanation?.textContent).toBe(
      "3 top-level PXI tool calls in this turn"
    );

    const createConfig = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Create");
    expect(createConfig).not.toBeUndefined();
    await act(async () => user.click(createConfig!));

    expect(document.body.textContent).toContain("Add annotation configuration");
    const selects = document.querySelectorAll<HTMLSelectElement>("select");
    expect(selects[0]?.value).toBe("CONTINUOUS");
    expect(selects[1]?.value).toBe("NONE");
    const bounds = document.querySelectorAll<HTMLInputElement>(
      'input[inputmode="decimal"]'
    );
    expect(Array.from(bounds).map((input) => input.value)).toEqual(["0", "3"]);

    const saveConfig = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save");
    expect(saveConfig).not.toBeUndefined();
    await act(async () => user.click(saveConfig!));

    expect(onCreateAnnotationConfig).toHaveBeenCalledWith({
      annotationType: "CONTINUOUS",
      description: null,
      id: "",
      lowerBound: 0,
      name: "tool_count_per_turn",
      optimizationDirection: "NONE",
      upperBound: 3,
    });

    const editAnnotation = document.querySelector<HTMLButtonElement>(
      '[aria-label="Edit annotation"]'
    );
    expect(editAnnotation).not.toBeNull();
    await act(async () => user.click(editAnnotation!));

    const editTitle = document.querySelector('[data-testid="dialog-title"]');
    expect(editTitle?.textContent).toBe("Edit Annotation");
    expect(editTitle?.getAttribute("data-level")).toBe("2");
    const editHeader = editTitle?.closest(".dialog__header");
    expect(
      editHeader?.querySelector(
        '[aria-label="Copy Annotation ID annotation-tool-count"]'
      )
    ).toBeNull();
    expect(editHeader?.textContent).not.toContain("alice");
    expect(document.body.textContent).not.toContain("Missing config");
    expect(
      Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some(
        (button) => button.textContent === "Create"
      )
    ).toBe(false);
    const valueRow = document.querySelector(
      ".annotation-value-editor__value-row"
    );
    expect(valueRow?.querySelectorAll("input")).toHaveLength(2);
    expect(
      document.querySelector<HTMLInputElement>(".react-aria-NumberField input")
        ?.value
    ).toBe("3");
    const explanationInput =
      document.querySelector<HTMLTextAreaElement>("textarea");
    const explanationField = explanationInput?.closest(
      ".annotation-value-editor__explanation"
    );
    expect(valueRow?.nextElementSibling).toBe(explanationField);
    expect(explanationInput?.classList).toContain("react-aria-TextArea");
    expect(explanationInput?.value).toBe(
      "3 top-level PXI tool calls in this turn"
    );
    expect(explanationInput?.rows).toBe(3);
    const saveAnnotation = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save annotation");
    expect(saveAnnotation).not.toBeUndefined();
    expect(saveAnnotation?.disabled).toBe(true);

    expect(
      document.querySelector(".annotation-value-editor__identity")
    ).toBeNull();

    const advancedButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Advanced");
    expect(advancedButton).not.toBeUndefined();
    expect(advancedButton?.closest(".dialog__footer")).not.toBeNull();
    expect(
      advancedButton?.closest('[data-testid="dialog-title-extra"]')
    ).toBeNull();
    await act(async () => user.click(advancedButton!));

    expect(
      Array.from(document.querySelectorAll<HTMLInputElement>("input:disabled"))
        .map((input) => input.value)
        .filter(Boolean)
    ).toEqual([]);
    const identityFields = document.querySelector(
      ".annotation-value-editor__identity"
    );
    expect(identityFields?.parentElement?.lastElementChild).toBe(
      identityFields
    );
    expect(identityFields?.children[0]?.textContent).toContain("alice");
    expect(
      identityFields?.children[0]?.querySelector(
        'img[alt="alice profile picture"]'
      )
    ).not.toBeNull();
    expect(
      identityFields?.children[1]?.matches(
        '[aria-label="Copy Annotation ID annotation-tool-count"]'
      )
    ).toBe(true);
    const advancedFields = document.querySelector(
      ".annotation-value-editor__advanced"
    );
    expect(
      advancedFields?.querySelector(".annotation-value-editor__identity")
    ).toBeNull();
    expect(advancedFields?.nextElementSibling).toBe(identityFields);
    const hideAdvancedButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Hide Advanced");
    expect(hideAdvancedButton).not.toBeUndefined();
    expect(hideAdvancedButton?.disabled).toBe(false);

    const labelInput = valueRow?.querySelector<HTMLInputElement>("input");
    await act(async () => user.type(labelInput!, "count"));
    expect(saveAnnotation?.disabled).toBe(false);
    expect(hideAdvancedButton?.textContent).toBe("Hide Advanced");
    expect(hideAdvancedButton?.disabled).toBe(false);
    const sourceSelect = document.querySelector<HTMLSelectElement>(
      '[aria-label="Annotation source"]'
    );
    const annotatorKindSelect = document.querySelector<HTMLSelectElement>(
      '[aria-label="Annotator kind"]'
    );
    expect(sourceSelect?.value).toBe("API");
    expect(annotatorKindSelect?.value).toBe("CODE");
    expect(
      document.querySelector(
        '.annotation-value-editor__metadata .cm-content[contenteditable="true"]'
      )
    ).not.toBeNull();

    await act(async () => user.selectOptions(sourceSelect!, "APP"));
    expect(hideAdvancedButton?.disabled).toBe(true);
    await act(async () => user.selectOptions(annotatorKindSelect!, "HUMAN"));
    expect(
      Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some(
        (button) => button.textContent === "Reset"
      )
    ).toBe(false);
    expect(hideAdvancedButton?.disabled).toBe(true);
    await act(async () => user.click(saveAnnotation!));

    expect(onUpdateAnnotation).toHaveBeenCalledWith({
      annotation: expect.objectContaining({ id: "annotation-tool-count" }),
      target: expect.objectContaining({ id: "span-1", kind: "span" }),
      value: {
        annotatorKind: "HUMAN",
        explanation: "3 top-level PXI tool calls in this turn",
        label: "count",
        metadata: { toolNames: ["search"] },
        score: 3,
        source: "APP",
      },
    });
  });
});
