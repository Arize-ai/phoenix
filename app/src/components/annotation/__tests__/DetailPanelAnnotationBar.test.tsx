import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@phoenix/components";
import {
  AnnotationValuePopover,
  DetailPanelAnnotationButton,
  DetailPanelAnnotationBar,
} from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import type { DetailPanelAnnotationBarProps } from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import type {
  Annotation,
  AnnotationConfig,
} from "@phoenix/components/annotation/types";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import {
  ViewerContext,
  type ViewerContextType,
} from "@phoenix/contexts/ViewerContext";
import { SpanFiltersContext } from "@phoenix/pages/project/SpanFiltersContext";

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

function buildViewer(id: string): NonNullable<ViewerContextType["viewer"]> {
  return {
    " $fragmentSpreads": {
      AuthorizedApplicationsCardFragment: true,
      ViewerAPIKeysListFragment: true,
    },
    authMethod: "LOCAL",
    email: `${id}@localhost`,
    id,
    isManagementUser: false,
    profilePictureUrl: null,
    role: { name: "MEMBER" },
    username: id,
  };
}

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
    variant,
    viewer = null,
  }: {
    allAnnotationConfigs?: AnnotationConfig[];
    projectAnnotationConfigs?: AnnotationConfig[];
    onCreateAnnotationConfig?: DetailPanelAnnotationBarProps["onCreateAnnotationConfig"];
    onCreateAnnotation?: DetailPanelAnnotationBarProps["onCreateAnnotation"];
    onDeleteAnnotation?: DetailPanelAnnotationBarProps["onDeleteAnnotation"];
    onUpdateAnnotation?: DetailPanelAnnotationBarProps["onUpdateAnnotation"];
    annotations?: Annotation[];
    variant?: DetailPanelAnnotationBarProps["variant"];
    viewer?: ViewerContextType["viewer"];
  } = {}) => {
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <ViewerContext.Provider
            value={{ viewer, refetchViewer: () => undefined }}
          >
            <MemoryRouter>
              <DetailPanelAnnotationBar
                allAnnotationConfigs={allAnnotationConfigs}
                projectAnnotationConfigs={projectAnnotationConfigs}
                projectName="My Project"
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
                variant={variant}
              />
            </MemoryRouter>
          </ViewerContext.Provider>
        </ThemeProvider>
      );
    });
  };

  const renderTableAnnotationPopover = ({
    appendFilterCondition,
    label = "good",
    score = 1,
    targetKind = "span",
    updatedAt,
  }: {
    appendFilterCondition: (condition: string) => void;
    label?: string;
    score?: number | null;
    targetKind?: "session" | "span" | "trace";
    updatedAt?: string;
  }) => {
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <MemoryRouter>
            <SpanFiltersContext.Provider
              value={{
                appendFilterCondition,
                filterCondition: "",
                rootSpansOnly: true,
                setFilterCondition: vi.fn(),
                setRootSpansOnly: vi.fn(),
              }}
            >
              <AnnotationValuePopover
                annotationName="quality"
                annotations={[
                  {
                    id: "annotation-1",
                    name: "quality",
                    label,
                    score,
                    updatedAt,
                  },
                ]}
                config={config}
                displayMode="table"
                onCreateAnnotation={createMutationResult}
                onCreateAnnotationConfig={mutationResult}
                onDeleteAnnotation={mutationResult}
                onUpdateAnnotation={mutationResult}
                onUpdateAnnotationConfig={mutationResult}
                renderTrigger={({ ref }) => (
                  <Button ref={ref} aria-label="Open quality annotation">
                    quality
                  </Button>
                )}
                target={{
                  annotations: [],
                  id: "span-1",
                  kind: targetKind,
                  label: "Span",
                }}
              />
            </SpanFiltersContext.Provider>
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

  it("repositions an open popover when its filled ghost label moves", async () => {
    const helpfulnessConfig = {
      ...config,
      id: "config-helpfulness",
      name: "helpfulness",
    };
    const annotationConfigs = [helpfulnessConfig, config];
    renderAnnotationBar({
      allAnnotationConfigs: annotationConfigs,
      projectAnnotationConfigs: annotationConfigs,
      annotations: [],
    });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        container.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );
    const handleResize = vi.fn();
    window.addEventListener("resize", handleResize);

    renderAnnotationBar({
      allAnnotationConfigs: annotationConfigs,
      projectAnnotationConfigs: annotationConfigs,
      annotations: [
        {
          id: "annotation-quality",
          name: "quality",
          label: "good",
          score: 1,
        },
      ],
    });
    window.removeEventListener("resize", handleResize);

    expect(handleResize).toHaveBeenCalledOnce();
    expect(
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Open "][aria-label$=" annotation"]'
        )
        ?.getAttribute("aria-label")
    ).toBe("Open quality annotation");
    expect(
      document.querySelector('[role="dialog"][aria-label="quality annotation"]')
    ).not.toBeNull();
  });

  it("opens a neighboring ghost annotation with the same press that dismisses the current one", async () => {
    const helpfulnessConfig = {
      ...config,
      id: "config-helpfulness",
      name: "helpfulness",
    };
    renderAnnotationBar({
      allAnnotationConfigs: [config, helpfulnessConfig],
      projectAnnotationConfigs: [config, helpfulnessConfig],
      annotations: [],
    });
    const user = userEvent.setup();
    const qualityTrigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Open quality annotation"]'
    );
    const helpfulnessTrigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Open helpfulness annotation"]'
    );

    await act(async () => user.click(qualityTrigger!));
    expect(
      document.querySelector('[role="dialog"][aria-label="quality annotation"]')
    ).not.toBeNull();

    await act(async () => user.click(helpfulnessTrigger!));

    expect(
      document.querySelector('[role="dialog"][aria-label="quality annotation"]')
    ).toBeNull();
    expect(
      document.querySelector(
        '[role="dialog"][aria-label="helpfulness annotation"]'
      )
    ).not.toBeNull();
    expect(qualityTrigger?.getAttribute("aria-expanded")).toBe("false");
    expect(helpfulnessTrigger?.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens the annotation bar from its row-action button", async () => {
    renderAnnotationBar({ variant: "button" });

    await act(async () => {
      await userEvent.click(
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Add annotation"]'
        )!
      );
    });

    expect(
      document.querySelector(
        '[role="dialog"][aria-label="Manage span annotations"]'
      )
    ).not.toBeNull();
  });

  it("does not activate a containing row from the annotation button", async () => {
    const onRowClick = vi.fn();

    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <div onClick={onRowClick}>
            <DetailPanelAnnotationButton targetKind="span">
              <div>Annotation menu</div>
            </DetailPanelAnnotationButton>
          </div>
        </ThemeProvider>
      );
    });

    await act(async () => {
      await userEvent.click(
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Add annotation"]'
        )!
      );
    });

    expect(onRowClick).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Annotation menu");
  });

  it("opens the detail-header annotation config menu from a compact row action", async () => {
    const longAnnotationName =
      "helpfulness with an annotation name that should never wrap onto another line";
    const helpfulnessConfig = {
      ...config,
      id: "config-helpfulness",
      name: longAnnotationName,
    };

    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <MemoryRouter>
            <DetailPanelAnnotationButton
              menuKind="annotation-configs"
              targetKind="span"
            >
              {(configMenuState) => (
                <DetailPanelAnnotationBar
                  allAnnotationConfigs={[config, helpfulnessConfig]}
                  configMenuState={configMenuState}
                  onAddAnnotationConfigToProject={mutationResult}
                  onCreateAnnotation={createMutationResult}
                  onCreateAnnotationConfig={mutationResult}
                  onDeleteAnnotation={mutationResult}
                  onRemoveAnnotationConfigFromProject={mutationResult}
                  onUpdateAnnotation={mutationResult}
                  onUpdateAnnotationConfig={mutationResult}
                  projectAnnotationConfigs={[config]}
                  projectName="My Project"
                  rows={[
                    {
                      id: "span-1",
                      kind: "target",
                      target: {
                        annotations: [],
                        id: "span-1",
                        kind: "span",
                      },
                    },
                  ]}
                  variant="config-menu"
                />
              )}
            </DetailPanelAnnotationButton>
          </MemoryRouter>
        </ThemeProvider>
      );
    });

    const configTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add annotation"]'
    );
    await act(async () => userEvent.click(configTrigger!));

    const menu = document.querySelector<HTMLElement>(
      '[role="menu"][aria-label="Project annotations"]'
    );
    const managementDialog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Manage project annotations"]'
    );
    const annotationOverlay = managementDialog?.closest<HTMLElement>(
      "[data-annotation-overlay]"
    );
    expect(menu).not.toBeNull();
    expect(managementDialog?.contains(menu)).toBe(true);
    expect(annotationOverlay).not.toBeNull();
    expect(document.body.textContent).toContain("Project annotations");
    expect(document.body.textContent).toContain("Used by My Project");
    expect(document.body.textContent).not.toContain("On this span");
    const longAnnotationLabel = menu?.querySelector<HTMLElement>(
      `[title="${longAnnotationName}"]`
    );
    expect(longAnnotationLabel?.style.maxWidth).toBe("250px");
    expect(getComputedStyle(longAnnotationLabel!).whiteSpace).toBe("nowrap");

    const newConfigButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "New annotation config");
    await act(async () => userEvent.click(newConfigButton!));

    const createDialog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Add annotation configuration"]'
    );
    const configEditor = createDialog?.querySelector<HTMLElement>(
      ".annotation-config-editor"
    );
    expect(createDialog).toBe(managementDialog);
    expect(createDialog?.closest("[data-annotation-overlay]")).toBe(
      annotationOverlay
    );
    expect(createDialog?.closest('[data-testid="modal-overlay"]')).toBeNull();
    expect(
      document.querySelector('[role="menu"][aria-label="Project annotations"]')
    ).toBeNull();
    expect(getComputedStyle(createDialog!).overflow).toBe("hidden");
    expect(getComputedStyle(configEditor!).overflow).toBe("auto");

    await act(async () => userEvent.keyboard("{Escape}"));

    expect(
      document.querySelector(
        '[role="dialog"][aria-label="Add annotation configuration"]'
      )
    ).toBeNull();
    expect(
      document.querySelector('[role="menu"][aria-label="Project annotations"]')
    ).not.toBeNull();
  });

  it("renders the row action as an ordered annotation menu", async () => {
    const helpfulnessConfig = {
      ...config,
      id: "config-helpfulness",
      name: "helpfulness",
    };
    renderAnnotationBar({
      allAnnotationConfigs: [helpfulnessConfig, config],
      projectAnnotationConfigs: [helpfulnessConfig, config],
      variant: "button",
    });
    const user = userEvent.setup();
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add annotation"]'
    );

    await act(async () => {
      await user.click(trigger!);
    });

    const menu = document.querySelector<HTMLElement>(
      '[role="menu"][aria-label="span annotations"]'
    );
    expect(menu).not.toBeNull();
    expect(
      Array.from(menu?.querySelectorAll('[role="menuitem"]') ?? []).map(
        (menuItem) => menuItem.textContent
      )
    ).toEqual(["quality1good", "helpfulness"]);
    expect(trigger?.dataset.annotationMenuOpen).toBe("true");
    expect(document.body.contains(trigger)).toBe(true);
    expect(
      Array.from(menu?.querySelectorAll("header") ?? []).map(
        (header) => header.textContent
      )
    ).toEqual(["On this span", "Available annotations"]);

    const currentAnnotationMenuItem =
      menu?.querySelector<HTMLElement>('[role="menuitem"]');
    expect(currentAnnotationMenuItem).not.toBeNull();
    await act(async () => {
      await user.click(currentAnnotationMenuItem!);
    });

    const annotationDialog = document.querySelector(
      '[role="dialog"][aria-label="quality annotation"]'
    );
    expect(annotationDialog).not.toBeNull();
    const annotationPlacement = annotationDialog?.closest("[data-placement]");
    if (!(annotationPlacement instanceof HTMLElement)) {
      throw new Error("Expected the annotation dialog placement container");
    }
    expect(annotationPlacement.dataset.placement).toBe("right");
    expect(
      annotationPlacement.querySelector(".react-aria-OverlayArrow")
    ).toBeNull();

    const availableAnnotationMenuItem = Array.from(
      menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    ).at(-1);
    await act(async () => user.hover(availableAnnotationMenuItem!));
    expect(
      document.querySelector('[role="dialog"][aria-label="quality annotation"]')
    ).not.toBeNull();
  });

  it("summarizes explanations beneath annotation menu values", async () => {
    const relevanceConfig = {
      ...config,
      id: "config-relevance",
      name: "relevance",
    };
    renderAnnotationBar({
      allAnnotationConfigs: [config, relevanceConfig],
      projectAnnotationConfigs: [config, relevanceConfig],
      annotations: [
        {
          id: "annotation-quality-1",
          name: "quality",
          label: "good",
          score: 1,
          explanation: "Strong evidence",
        },
        {
          id: "annotation-quality-2",
          name: "quality",
          label: "good",
          score: 0,
        },
        {
          id: "annotation-relevance",
          name: "relevance",
          score: 0.5,
          explanation: "Directly addresses the question",
        },
      ],
      variant: "button",
    });
    const user = userEvent.setup();

    await act(async () => {
      await user.click(
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Add annotation"]'
        )!
      );
    });

    const descriptions = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="menu"] .annotation-explanation-summary'
      )
    ).map((description) => description.textContent);
    expect(descriptions).toEqual([
      "mixed explanations",
      "Directly addresses the question",
    ]);
    const relevanceMenuItem = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((menuItem) => menuItem.textContent?.includes("relevance"));
    expect(relevanceMenuItem?.textContent).toContain("0.5--");
  });

  it("does not render row annotation content until the plus button opens", async () => {
    const onContentRender = vi.fn();
    function DeferredContent() {
      onContentRender();
      return <div>Deferred annotations</div>;
    }

    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <DetailPanelAnnotationButton targetKind="span">
            <DeferredContent />
          </DetailPanelAnnotationButton>
        </ThemeProvider>
      );
    });

    expect(onContentRender).not.toHaveBeenCalled();

    await act(async () => {
      await userEvent.click(
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Add annotation"]'
        )!
      );
    });

    expect(onContentRender).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain("Deferred annotations");
  });

  it("does not offer editing for the built-in user feedback config", async () => {
    const userFeedbackConfig: AnnotationConfig = {
      ...config,
      id: "config-user-feedback",
      name: "user_feedback",
      values: [
        { label: "positive", score: 1 },
        { label: "negative", score: 0 },
      ],
    };
    renderAnnotationBar({
      allAnnotationConfigs: [userFeedbackConfig],
      projectAnnotationConfigs: [userFeedbackConfig],
      annotations: [
        {
          id: "annotation-user-feedback",
          name: "user_feedback",
          label: "positive",
          score: 1,
        },
      ],
    });
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Open user_feedback annotation"]'
    );

    await act(async () => user.click(trigger!));

    expect(
      document.querySelector(
        '[aria-label="Edit user_feedback annotation configuration"]'
      )
    ).toBeNull();
  });

  it("hides add annotation when it would override the viewer's annotation", async () => {
    const viewer = buildViewer("viewer-1");
    renderAnnotationBar({
      annotations: [
        {
          id: "annotation-1",
          identifier: `px-app:${viewer.id}`,
          name: "quality",
          label: "good",
          score: 1,
        },
      ],
      viewer,
    });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );

    expect(
      Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === "Add annotation"
      )
    ).toBeUndefined();
  });

  it("shows add annotation when it will create a separate annotation", async () => {
    const viewer = buildViewer("viewer-1");
    renderAnnotationBar({
      annotations: [
        {
          id: "annotation-1",
          identifier: "external-evaluator",
          name: "quality",
          label: "good",
          score: 1,
        },
      ],
      viewer,
    });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );

    expect(
      Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === "Add annotation"
      )
    ).not.toBeUndefined();
  });

  it("hides add annotation when an existing identifier is unknown", async () => {
    renderAnnotationBar();
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );

    expect(
      Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === "Add annotation"
      )
    ).toBeUndefined();
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
    expect(summaryScore?.textContent).toBe("1");
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
    const createDialog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Add annotation configuration"]'
    );
    expect(createDialog?.closest("[data-annotation-overlay]")).not.toBeNull();
    expect(createDialog?.closest('[data-testid="modal-overlay"]')).toBeNull();
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

  it("rejects a continuous maximum that is not greater than the minimum", async () => {
    const onCreateAnnotationConfig = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotationConfig"]>()
      .mockResolvedValue({ success: true });
    renderAnnotationBar({ onCreateAnnotationConfig });
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add annotation"]'
    );

    await act(async () => user.click(trigger!));
    const newConfigButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "New annotation config");
    await act(async () => user.click(newConfigButton!));

    const name = document.querySelector<HTMLInputElement>(
      'input:not([inputmode="decimal"])'
    );
    await act(async () => user.type(name!, "quality_score"));
    const type = document.querySelector<HTMLSelectElement>("select");
    await act(async () => user.selectOptions(type!, "CONTINUOUS"));

    const bounds = document.querySelectorAll<HTMLInputElement>(
      ".annotation-config-editor__number-field input"
    );
    await act(async () => {
      await user.clear(bounds[1]!);
      await user.type(bounds[1]!, "-1");
    });

    const save = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save");
    await act(async () => user.click(save!));

    expect(document.body.textContent).toContain(
      "Maximum must be greater than minimum"
    );
    expect(save?.disabled).toBe(true);
    expect(onCreateAnnotationConfig).not.toHaveBeenCalled();
  });

  it("preserves tiny continuous values within the conveyed precision", async () => {
    const onCreateAnnotationConfig = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotationConfig"]>()
      .mockResolvedValue({ success: true });
    renderAnnotationBar({ onCreateAnnotationConfig });
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add annotation"]'
    );

    await act(async () => user.click(trigger!));
    const newConfigButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "New annotation config");
    await act(async () => user.click(newConfigButton!));
    const name = document.querySelector<HTMLInputElement>(
      'input:not([inputmode="decimal"])'
    );
    await act(async () => user.type(name!, "tiny_score"));
    const type = document.querySelector<HTMLSelectElement>("select");
    await act(async () => user.selectOptions(type!, "CONTINUOUS"));

    const bounds = document.querySelectorAll<HTMLInputElement>(
      ".annotation-config-editor__number-field input"
    );
    const tinyValue = "0.000000000000000000000002";
    await act(async () => {
      await user.clear(bounds[0]!);
      await user.type(bounds[0]!, tinyValue);
      await user.tab();
    });

    expect(bounds[0]?.value).toBe(tinyValue);
    expect(document.body.textContent).not.toContain("significant digits");
    const save = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save");
    await act(async () => user.click(save!));
    expect(onCreateAnnotationConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        annotationType: "CONTINUOUS",
        lowerBound: 2e-24,
      })
    );
  });

  it("shows the numeric precision limit only when it is exceeded", async () => {
    const onCreateAnnotationConfig = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotationConfig"]>()
      .mockResolvedValue({ success: true });
    renderAnnotationBar({ onCreateAnnotationConfig });
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add annotation"]'
    );

    await act(async () => user.click(trigger!));
    const newConfigButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "New annotation config");
    await act(async () => user.click(newConfigButton!));
    const name = document.querySelector<HTMLInputElement>(
      'input:not([inputmode="decimal"])'
    );
    await act(async () => user.type(name!, "precise_score"));
    const type = document.querySelector<HTMLSelectElement>("select");
    await act(async () => user.selectOptions(type!, "CONTINUOUS"));

    const bounds = document.querySelectorAll<HTMLInputElement>(
      ".annotation-config-editor__number-field input"
    );
    expect(document.body.textContent).not.toContain("significant digits");
    await act(async () => {
      await user.clear(bounds[0]!);
      await user.type(bounds[0]!, "0.1234567890123456");
    });

    expect(document.body.textContent).toContain(
      "Use 15 or fewer significant digits"
    );
    const save = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save");
    expect(save?.disabled).toBe(true);
    expect(onCreateAnnotationConfig).not.toHaveBeenCalled();
  });

  it("contains long annotation config creation errors", async () => {
    const longError =
      "createAnnotationConfig.validation.maximum_must_be_greater_than_minimum";
    const onCreateAnnotationConfig = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotationConfig"]>()
      .mockResolvedValue({ error: longError, success: false });
    renderAnnotationBar({ onCreateAnnotationConfig });
    const user = userEvent.setup();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add annotation"]'
    );

    await act(async () => user.click(trigger!));
    const newConfigButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "New annotation config");
    await act(async () => user.click(newConfigButton!));
    const name = document.querySelector<HTMLInputElement>(
      'input:not([inputmode="decimal"])'
    );
    await act(async () => user.type(name!, "quality_score"));
    const save = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Save");
    await act(async () => user.click(save!));

    const alertContent = document.querySelector<HTMLElement>(".alert__content");
    expect(alertContent?.textContent).toBe(longError);
    expect(["0", "0px"]).toContain(getComputedStyle(alertContent!).minWidth);
    expect(getComputedStyle(alertContent!).overflowWrap).toBe("anywhere");
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
    ).toEqual(["good1Explain", "bad0Explain"]);
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
    ).toBe("1");
    expect(
      goodChoice
        ?.querySelector('[data-direction="positive"]')
        ?.getAttribute("data-optimization-value")
    ).toBe("1");
    expect(
      badChoice?.querySelector('[data-direction="negative"]')?.textContent
    ).toBe("0");
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

  it("creates a normalized continuous annotation from semantic quick values", async () => {
    const continuousConfig: AnnotationConfig = {
      annotationType: "CONTINUOUS",
      description: null,
      id: "config-score",
      lowerBound: 0,
      name: "score",
      optimizationDirection: "MAXIMIZE",
      upperBound: 1,
    };
    const onCreateAnnotation = vi
      .fn<DetailPanelAnnotationBarProps["onCreateAnnotation"]>()
      .mockResolvedValue({
        success: true,
        annotation: { id: "annotation-created", name: "score", score: 0.5 },
      });
    renderAnnotationBar({
      allAnnotationConfigs: [continuousConfig],
      annotations: [],
      onCreateAnnotation,
      projectAnnotationConfigs: [continuousConfig],
    });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open score annotation"]'
        )!
      )
    );

    const values = document.querySelector('[aria-label="score values"]');
    expect(values?.querySelectorAll("li")).toHaveLength(11);
    expect(values?.textContent).toBe("0.00.10.20.30.40.50.60.70.80.91.0");
    const midpoint = values?.querySelector<HTMLButtonElement>(
      '[aria-label="Add 0.5"]'
    );
    if (midpoint == null) {
      throw new Error("Expected the normalized continuous midpoint");
    }
    await act(async () => user.click(midpoint));
    expect(onCreateAnnotation).toHaveBeenCalledWith({
      annotationName: "score",
      target: expect.objectContaining({ id: "span-1" }),
      value: expect.objectContaining({ score: 0.5 }),
    });
  });

  it("opens the exact bounded slider from continuous Explain", async () => {
    const continuousConfig: AnnotationConfig = {
      annotationType: "CONTINUOUS",
      description: null,
      id: "config-score",
      lowerBound: -1,
      name: "score",
      optimizationDirection: "NONE",
      upperBound: 1,
    };
    renderAnnotationBar({
      allAnnotationConfigs: [continuousConfig],
      annotations: [],
      projectAnnotationConfigs: [continuousConfig],
    });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open score annotation"]'
        )!
      )
    );
    const explain = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Explain");
    await act(async () => user.click(explain!));

    expect(
      document.querySelector('[aria-label="score exact value"]')
    ).not.toBeNull();
    expect(document.querySelector(".slider__track")).not.toBeNull();
  });

  it("uses an unbounded number input when a continuous maximum is absent", async () => {
    const steeringEventsConfig: AnnotationConfig = {
      annotationType: "CONTINUOUS",
      description: "Counts user steering events.",
      id: "config-steering-events",
      lowerBound: 0,
      name: "Steering Events",
      optimizationDirection: "MINIMIZE",
      upperBound: null,
    };
    renderAnnotationBar({
      allAnnotationConfigs: [steeringEventsConfig],
      annotations: [],
      projectAnnotationConfigs: [steeringEventsConfig],
    });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open Steering Events annotation"]'
        )!
      )
    );

    expect(document.querySelector(".slider__track")).toBeNull();
    expect(
      document.querySelector('[aria-label="Steering Events exact value"]')
    ).toBeNull();
    expect(
      Array.from(document.querySelectorAll("label")).some(
        (label) => label.textContent === "Steering Events"
      )
    ).toBe(true);
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
    expect(originalAnnotation?.textContent).toContain("1");
    expect(renamedAnnotation?.dataset.variant).toBe("ghost");
    expect(renamedAnnotation?.textContent).not.toContain("1");
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

  it("opens table score filters in a titled menu beside the more button", async () => {
    const appendFilterCondition = vi.fn();
    renderTableAnnotationPopover({ appendFilterCondition });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );

    const annotationValue = document.querySelector(".annotation-entry__value");
    const annotationPopover = document.querySelector<HTMLElement>(
      "[data-annotation-overlay]"
    );
    const annotationDialog = annotationPopover?.querySelector<HTMLElement>(
      ":scope > .react-aria-Dialog"
    );
    expect(getComputedStyle(annotationPopover!).display).toBe("flex");
    expect(getComputedStyle(annotationPopover!).overflow).not.toBe("auto");
    expect(getComputedStyle(annotationDialog!).overflow).toBe("auto");
    expect(
      annotationPopover?.querySelector(":scope > .react-aria-OverlayArrow")
    ).not.toBeNull();
    const annotationActions = document.querySelector(
      ".annotation-entry__actions"
    );
    const tableActions = annotationActions?.querySelector<HTMLElement>(
      ".annotation-table-actions"
    );
    const filterControl = tableActions?.querySelector<HTMLElement>(
      ".annotation-filter-actions"
    );
    const filterTrigger = filterControl?.querySelector<HTMLButtonElement>(
      '[aria-label="Filter spans by annotation value"]'
    );
    const filterTriggerLabel = filterTrigger?.querySelector<HTMLElement>(
      ".annotation-filter-actions__trigger-label"
    );
    const filterSizer = filterControl?.querySelector<HTMLElement>(
      ".annotation-filter-actions__sizer"
    );
    const moreActionsButton = tableActions?.querySelector<HTMLButtonElement>(
      '[aria-label="More annotation actions"]'
    );

    expect(
      annotationValue?.querySelector(".annotation-filter-actions")
    ).toBeNull();
    expect(filterControl?.nextElementSibling).toBe(moreActionsButton);
    expect(getComputedStyle(tableActions!).display).toBe("flex");
    expect(getComputedStyle(tableActions!).flexDirection).toBe("row");
    expect(getComputedStyle(tableActions!).direction).toBe("ltr");
    expect(getComputedStyle(filterControl!).order).toBe("1");
    expect(getComputedStyle(moreActionsButton!).order).toBe("2");
    expect(filterControl?.dataset.open).toBe("false");
    expect(getComputedStyle(filterControl!).width).toBe("auto");
    expect(filterSizer?.getAttribute("aria-hidden")).toBe("true");
    expect(filterSizer?.textContent).toBe("Filter");
    expect(getComputedStyle(filterSizer!).visibility).toBe("hidden");
    expect(getComputedStyle(filterSizer!).position).toBe("static");
    expect(getComputedStyle(filterTrigger!).width).toBe(
      "var(--global-button-height-s)"
    );
    expect(getComputedStyle(filterTrigger!).position).toBe("absolute");
    expect(getComputedStyle(filterTrigger!).right).toBe("0px");
    expect(filterTrigger?.dataset.variant).toBe("quiet");
    expect(filterTrigger?.classList.contains("react-aria-Button")).toBe(true);
    expect(moreActionsButton?.classList.contains("react-aria-Button")).toBe(
      false
    );
    expect(filterTriggerLabel?.textContent).toBe("Filter");
    expect(getComputedStyle(filterTriggerLabel!).display).toBe("none");
    expect(document.querySelector('[aria-label="Edit annotation"]')).toBeNull();
    expect(
      document.querySelector('[aria-label="Delete annotation"]')
    ).toBeNull();

    await act(async () => user.hover(filterControl!));

    expect(getComputedStyle(filterTriggerLabel!).display).toBe("none");
    expect(getComputedStyle(filterTrigger!).width).toBe(
      "var(--global-button-height-s)"
    );

    await act(async () => user.hover(filterTrigger!));

    expect(getComputedStyle(filterTriggerLabel!).display).toBe("inline");
    expect(getComputedStyle(filterTrigger!).width).toBe("auto");

    await act(async () => user.click(filterTrigger!));

    expect(filterControl?.dataset.open).toBe("true");
    const filterMenu = document.querySelector<HTMLElement>(
      "[data-annotation-filter-menu]"
    );
    expect(filterMenu).not.toBeNull();
    expect(
      filterMenu?.querySelector('[data-testid="menu-header-title"]')
        ?.textContent
    ).toBe("Filter spans");
    const filterMenuList =
      filterMenu!.querySelector<HTMLElement>('[role="menu"]')!;
    expect(
      getComputedStyle(filterMenuList).getPropertyValue("--menu-min-width")
    ).toBe("var(--global-dimension-size-2500)");
    expect(getComputedStyle(filterMenuList).width).toBe("auto");
    expect(getComputedStyle(filterMenuList.parentElement!).minWidth).toBe(
      "0px"
    );
    const filterMenuItems = Array.from(
      filterMenu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    expect(filterMenuItems.map((item) => item.textContent?.trim())).toEqual([
      "Higher than1",
      "Lower than1",
      "Exactly1",
      "Not1",
    ]);
    expect(
      filterMenuItems.map(
        (item) => item.querySelector('[data-appearance="compact"]')?.textContent
      )
    ).toEqual(["1", "1", "1", "1"]);
    const firstFilterSentence = filterMenuItems[0]!.querySelector<HTMLElement>(
      ".annotation-filter-actions__sentence"
    )!;
    expect(firstFilterSentence.textContent).toBe("Higher than1");
    expect(
      firstFilterSentence.querySelector(
        ".annotation-filter-actions__score-value"
      )
    ).not.toBeNull();
    expect(getComputedStyle(firstFilterSentence).display).toBe("flex");
    expect(getComputedStyle(firstFilterSentence).gap).toBe(
      "var(--global-dimension-size-100)"
    );
    expect(
      getComputedStyle(
        filterMenuItems[0]!.querySelector<HTMLElement>(
          ".annotation-filter-actions__score-value"
        )!
      ).maxWidth
    ).toBe("var(--global-dimension-size-3000)");

    await act(async () => user.click(filterMenuItems[2]!));

    expect(appendFilterCondition).toHaveBeenCalledWith(
      "annotations['quality'].score == 1"
    );
    expect(document.querySelector("[data-annotation-filter-menu]")).toBeNull();
    expect(
      document.querySelector('[role="dialog"][aria-label="quality annotation"]')
    ).not.toBeNull();
  });

  it("keeps only one adjacent annotation action menu open", async () => {
    renderTableAnnotationPopover({ appendFilterCondition: vi.fn() });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );
    const filterButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Filter spans by annotation value"]'
    )!;
    const moreButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="More annotation actions"]'
    )!;

    await act(async () => user.click(filterButton));
    expect(
      document.querySelector("[data-annotation-filter-menu]")
    ).not.toBeNull();
    expect(document.querySelector("[data-annotation-actions-menu]")).toBeNull();

    await act(async () => user.click(moreButton));
    expect(document.querySelector("[data-annotation-filter-menu]")).toBeNull();
    expect(
      document.querySelector("[data-annotation-actions-menu]")
    ).not.toBeNull();

    await act(async () => user.click(filterButton));
    expect(
      document.querySelector("[data-annotation-filter-menu]")
    ).not.toBeNull();
    expect(document.querySelector("[data-annotation-actions-menu]")).toBeNull();
  });

  it("truncates long annotation values at roughly 250 pixels", async () => {
    const label = "A very long annotation label value that should be truncated";
    renderTableAnnotationPopover({
      appendFilterCondition: vi.fn(),
      label,
      score: null,
    });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );

    const annotationEntryLabel = document.querySelector<HTMLElement>(
      ".annotation-entry__value .text"
    )!;
    expect(annotationEntryLabel.title).toBe(label);
    expect(getComputedStyle(annotationEntryLabel).minWidth).toBe("0px");
    expect(getComputedStyle(annotationEntryLabel).textOverflow).toBe(
      "ellipsis"
    );

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Filter spans by annotation value"]'
        )!
      )
    );

    const labelValue = document.querySelector<HTMLElement>(
      ".annotation-filter-actions__label-value"
    )!;
    expect(labelValue.title).toBe(label);
    expect(getComputedStyle(labelValue).maxWidth).toBe(
      "var(--global-dimension-size-3000)"
    );
    expect(getComputedStyle(labelValue).textOverflow).toBe("ellipsis");
  });

  it("shows the annotation modification date when hovering its value", async () => {
    const updatedAt = "2026-07-31T19:42:00Z";
    renderTableAnnotationPopover({
      appendFilterCondition: vi.fn(),
      updatedAt,
    });
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );

    const annotationValue = document.querySelector<HTMLElement>(
      ".annotation-entry__value"
    );
    expect(annotationValue?.title).toBe(
      `Modified: ${new Date(updatedAt).toLocaleString()}`
    );
    expect(annotationValue?.querySelector("[title]")).toBeNull();
  });

  it.each([
    ["session", "Filter sessions"],
    ["span", "Filter spans"],
    ["trace", "Filter traces"],
  ] as const)(
    "titles the %s annotation filter menu",
    async (targetKind, title) => {
      renderTableAnnotationPopover({
        appendFilterCondition: vi.fn(),
        targetKind,
      });
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
            `[aria-label="Filter ${targetKind}s by annotation value"]`
          )!
        )
      );

      expect(
        document.querySelector(
          '[data-annotation-filter-menu] [data-testid="menu-header-title"]'
        )?.textContent
      ).toBe(title);
    }
  );

  it("swallows the outside interaction that dismisses the annotation popover", async () => {
    const underlyingButton = document.createElement("button");
    const onUnderlyingPointerDown = vi.fn();
    const onUnderlyingClick = vi.fn();
    underlyingButton.textContent = "Underlying action";
    underlyingButton.addEventListener("pointerdown", onUnderlyingPointerDown);
    underlyingButton.addEventListener("click", onUnderlyingClick);
    document.body.appendChild(underlyingButton);
    const user = userEvent.setup();

    await act(async () =>
      user.click(
        document.querySelector<HTMLButtonElement>(
          '[aria-label="Open quality annotation"]'
        )!
      )
    );
    expect(
      document.querySelector('[role="dialog"][aria-label="quality annotation"]')
    ).not.toBeNull();

    await act(async () => user.click(underlyingButton));

    expect(onUnderlyingPointerDown).not.toHaveBeenCalled();
    expect(onUnderlyingClick).not.toHaveBeenCalled();
    expect(
      document.querySelector('[role="dialog"][aria-label="quality annotation"]')
    ).toBeNull();

    await act(async () => user.click(underlyingButton));
    expect(onUnderlyingPointerDown).toHaveBeenCalledOnce();
    expect(onUnderlyingClick).toHaveBeenCalledOnce();

    underlyingButton.remove();
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
    expect(
      annotationActions?.querySelector('[aria-label="Edit annotation"]')
    ).not.toBeNull();
    const deleteAnnotationButton =
      annotationActions?.querySelector<HTMLButtonElement>(
        '[aria-label="Delete annotation"]'
      );
    expect(deleteAnnotationButton?.dataset.variant).toBe("danger");
    expect(
      annotationActions?.querySelector('[aria-label="More annotation actions"]')
    ).toBeNull();
    expect(
      annotationEntry?.querySelector(
        '[role="group"][aria-label="Filter annotation value"]'
      )
    ).toBeNull();
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
    ).toBe("1good");
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
    expect(
      annotationActions?.querySelector('[aria-label="More annotation actions"]')
    ).toBeNull();
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
      ".annotation-config-editor__number-field input"
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
