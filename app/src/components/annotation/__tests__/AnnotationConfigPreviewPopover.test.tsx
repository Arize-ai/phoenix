import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import {
  type AnnotationBarRow,
  DetailPanelAnnotationBar,
} from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import type {
  AnnotationConfig,
  AnnotationConfigCategorical,
} from "@phoenix/components/annotation/types";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

const annotationConfig: AnnotationConfigCategorical = {
  id: "config-toxicity",
  name: "toxicity",
  description: "Whether the response contains harmful language.",
  annotationType: "CATEGORICAL",
  optimizationDirection: "MINIMIZE",
  values: [
    { label: "safe", score: 0 },
    { label: "toxic", score: 1 },
  ],
};

describe("add annotation menu", () => {
  installTestMatchMedia();

  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderAnnotationBar({
    allAnnotationConfigs = [annotationConfig],
    projectAnnotationConfigs = [],
    projectName = "My Project",
    rows = [
      {
        id: "span-row",
        kind: "target",
        target: {
          annotations: [],
          id: "span-1",
          kind: "span",
          label: "This span",
        },
      },
    ],
  }: {
    allAnnotationConfigs?: readonly AnnotationConfig[];
    projectAnnotationConfigs?: readonly AnnotationConfig[];
    projectName?: string;
    rows?: readonly AnnotationBarRow[];
  } = {}) {
    const successfulMutation = async () => ({ success: true }) as const;
    const successfulCreateMutation = async () =>
      ({
        success: true,
        annotation: {
          id: "annotation-created",
          name: annotationConfig.name,
          label: annotationConfig.values?.[0]?.label,
          score: annotationConfig.values?.[0]?.score,
        },
      }) as const;
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <DetailPanelAnnotationBar
              rows={rows}
              allAnnotationConfigs={allAnnotationConfigs}
              projectAnnotationConfigs={projectAnnotationConfigs}
              projectName={projectName}
              onAddAnnotationConfigToProject={successfulMutation}
              onCreateAnnotation={successfulCreateMutation}
              onCreateAnnotationConfig={successfulMutation}
              onDeleteAnnotation={successfulMutation}
              onRemoveAnnotationConfigFromProject={successfulMutation}
              onUpdateAnnotation={successfulMutation}
              onUpdateAnnotationConfig={successfulMutation}
            />
          </ThemeProvider>
        </MemoryRouter>
      );
    });
  }

  function getAddAnnotationTrigger() {
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add annotation"]'
    );
    if (!trigger) {
      throw new Error("Add annotation trigger was not rendered");
    }
    return trigger;
  }

  it("uses a small quiet button for the add annotation action", async () => {
    await renderAnnotationBar();

    const trigger = getAddAnnotationTrigger();
    expect(trigger.dataset.size).toBe("S");
    expect(trigger.dataset.variant).toBe("quiet");
    expect(trigger.querySelector("svg")).toBeNull();
  });

  it("uses a plus icon when the project has annotation configs", async () => {
    await renderAnnotationBar({
      projectAnnotationConfigs: [annotationConfig],
    });

    const trigger = getAddAnnotationTrigger();
    expect(trigger.textContent).toBe("");
    expect(trigger.querySelector("svg")).not.toBeNull();
  });

  it("uses plus icons in every row when any displayed item has annotations", async () => {
    await renderAnnotationBar({
      rows: [
        {
          id: "trace-row",
          kind: "target",
          target: {
            annotations: [],
            id: "trace-1",
            kind: "trace",
            label: "Trace",
          },
        },
        {
          id: "span-row",
          kind: "target",
          target: {
            annotations: [
              {
                id: "annotation-1",
                name: annotationConfig.name,
                label: "safe",
                score: 0,
              },
            ],
            id: "span-1",
            kind: "span",
            label: "This span",
          },
        },
      ],
    });

    const triggers = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Add annotation"]'
    );
    expect(triggers).toHaveLength(2);
    for (const trigger of triggers) {
      expect(trigger.textContent).toBe("");
      expect(trigger.querySelector("svg")).not.toBeNull();
    }
  });

  function getConfigTrigger() {
    const trigger = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((menuItem) => menuItem.textContent?.includes(annotationConfig.name));
    if (!trigger) {
      throw new Error("Annotation config trigger was not rendered");
    }
    return trigger;
  }

  it("stays open when a menu item is hovered", async () => {
    await renderAnnotationBar();
    const user = userEvent.setup();

    await act(async () => user.click(getAddAnnotationTrigger()));
    await act(async () => user.hover(getConfigTrigger()));

    expect(getAddAnnotationTrigger().getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(
      document.querySelector('[aria-label="Manage this span annotations"]')
    ).not.toBeNull();
  });

  it("renders annotations with the shared menu primitives", async () => {
    await renderAnnotationBar();
    const user = userEvent.setup();

    await act(async () => user.click(getAddAnnotationTrigger()));

    const manageLink = document.querySelector<HTMLAnchorElement>(
      'a[href="/settings/annotations"]'
    );
    expect(manageLink?.textContent).toBe("Manage");
    expect(manageLink?.querySelector("svg")).toBeNull();
    expect(document.body.textContent).not.toContain("Available annotations");
    const menuDialog = document.querySelector(
      '[aria-label="Manage this span annotations"]'
    );
    expect(
      menuDialog?.querySelector('[data-testid="menu-header-title"]')
        ?.textContent
    ).toContain("Project annotations");
    expect(
      menuDialog?.querySelector<HTMLElement>(".search-field")?.dataset.variant
    ).toBe("quiet");

    const configTrigger = getConfigTrigger();
    expect(configTrigger.querySelector("svg")).toBeNull();
    expect(configTrigger.textContent).toContain("Add");

    const menu = menuDialog?.querySelector('[role="menu"]');
    expect(menu?.getAttribute("aria-label")).toBe("Project annotations");
    expect(menu?.querySelectorAll('[role="menuitem"]')).toHaveLength(1);
    const newConfigItem = Array.from(
      menuDialog?.querySelectorAll<HTMLButtonElement>("button") ?? []
    ).find((button) => button.textContent === "New annotation config");
    expect(newConfigItem?.textContent).toBe("New annotation config");

    await act(async () => user.click(newConfigItem!));
    expect(document.body.textContent).toContain("Add annotation configuration");
  });

  it("lists project annotations before annotations available in Phoenix", async () => {
    const availableAnnotationConfig: AnnotationConfig = {
      ...annotationConfig,
      id: "config-quality",
      name: "quality",
    };
    await renderAnnotationBar({
      allAnnotationConfigs: [annotationConfig, availableAnnotationConfig],
      projectAnnotationConfigs: [annotationConfig],
      projectName: "a".repeat(45),
    });
    const user = userEvent.setup();

    await act(async () => user.click(getAddAnnotationTrigger()));

    const menuItems =
      document.querySelectorAll<HTMLElement>('[role="menuitem"]');
    expect(menuItems).toHaveLength(2);
    expect(menuItems[0]?.textContent).toContain("toxicity");
    expect(menuItems[0]?.textContent).toContain("Remove");
    expect(menuItems[1]?.textContent).toContain("quality");
    expect(menuItems[1]?.textContent).toContain("Add");
    expect(document.body.textContent).toContain(`Used by ${"a".repeat(37)}...`);
    expect(document.body.textContent).toContain("Available in Phoenix");
  });

  it("uses one actionable menu item for each project annotation", async () => {
    await renderAnnotationBar({ projectAnnotationConfigs: [annotationConfig] });
    const user = userEvent.setup();

    await act(async () => user.click(getAddAnnotationTrigger()));

    const removeItem = getConfigTrigger();
    expect(removeItem.querySelectorAll("button")).toHaveLength(0);
    expect(removeItem.querySelector("svg")).toBeNull();
    expect(removeItem.textContent).toContain("Remove");
  });

  it("keeps the annotations popover beneath the removal modal backdrop", async () => {
    await renderAnnotationBar({ projectAnnotationConfigs: [annotationConfig] });
    const user = userEvent.setup();

    await act(async () => user.click(getAddAnnotationTrigger()));
    const annotationDialog = document.querySelector(
      '[aria-label="Manage this span annotations"]'
    );
    const annotationPopover = annotationDialog?.closest(".react-aria-Popover");
    expect(annotationPopover).not.toBeNull();

    await act(async () => user.click(getConfigTrigger()));

    const modalOverlay = document.querySelector(
      '[data-testid="modal-overlay"]'
    );
    expect(modalOverlay).not.toBeNull();
    expect(
      document.querySelector("[data-annotation-removal-modal]")
    ).not.toBeNull();
    expect(getComputedStyle(annotationPopover!).zIndex).toBe(
      "var(--global-z-index-app-floating)"
    );
    expect(getComputedStyle(modalOverlay!).zIndex).toBe(
      "var(--global-z-index-app-modal-backdrop)"
    );
  });
});
