import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import {
  type AnnotationBarRow,
  DetailPanelAnnotationBar,
} from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import type { AnnotationConfig } from "@phoenix/components/annotation/types";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

const annotationConfig: AnnotationConfig = {
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

describe("annotation config preview popover", () => {
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
    projectAnnotationConfigs = [],
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
    projectAnnotationConfigs?: readonly AnnotationConfig[];
    rows?: readonly AnnotationBarRow[];
  } = {}) {
    const successfulMutation = async () => ({ success: true }) as const;
    const successfulCreateMutation = async () =>
      ({
        success: true,
        annotation: {
          id: "annotation-created",
          name: annotationConfig.name,
          label: annotationConfig.values[0]?.label,
          score: annotationConfig.values[0]?.score,
        },
      }) as const;
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <DetailPanelAnnotationBar
              rows={rows}
              allAnnotationConfigs={[annotationConfig]}
              projectAnnotationConfigs={projectAnnotationConfigs}
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
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === annotationConfig.name);
    if (!trigger) {
      throw new Error("Annotation config trigger was not rendered");
    }
    return trigger;
  }

  function getPreview() {
    return document.querySelector(
      `[aria-label="${annotationConfig.name} annotation preview"]`
    );
  }

  it("closes on hover end and outside press across subsequent opens", async () => {
    await renderAnnotationBar();
    const user = userEvent.setup();

    await act(async () => user.click(getAddAnnotationTrigger()));
    const firstConfigTrigger = getConfigTrigger();
    vi.spyOn(firstConfigTrigger, "getBoundingClientRect").mockReturnValue({
      bottom: 132,
      height: 32,
      left: 100,
      right: 420,
      top: 100,
      width: 320,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });

    await act(async () => user.hover(firstConfigTrigger));
    expect(
      document.querySelector('[aria-label="Manage this span annotations"]')
    ).not.toBeNull();
    expect(getPreview()).not.toBeNull();
    expect(
      getPreview()
        ?.closest<HTMLElement>(".react-aria-Popover")
        ?.style.getPropertyValue("--trigger-width")
    ).toBe("320px");

    await act(async () => user.unhover(firstConfigTrigger));
    expect(getPreview()).toBeNull();

    await act(async () => user.hover(firstConfigTrigger));
    expect(getPreview()).not.toBeNull();

    const outsideTarget = document.createElement("div");
    document.body.appendChild(outsideTarget);
    act(() => {
      outsideTarget.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          composed: true,
        })
      );
      outsideTarget.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          composed: true,
        })
      );
    });
    expect(getPreview()).toBeNull();
    outsideTarget.remove();
  });

  it("renders available annotations and actions as lists", async () => {
    await renderAnnotationBar();
    const user = userEvent.setup();

    await act(async () => user.click(getAddAnnotationTrigger()));

    const manageLink = document.querySelector<HTMLAnchorElement>(
      'a[href="/settings/annotations"]'
    );
    expect(manageLink?.textContent).toBe("Manage");
    expect(manageLink?.querySelector("svg")).toBeNull();
    expect(document.body.textContent).not.toContain("Available annotations");

    const configTrigger = getConfigTrigger();
    expect(configTrigger.querySelector("svg")).not.toBeNull();

    const menuDialog = document.querySelector(
      '[aria-label="Manage this span annotations"]'
    );
    const lists = menuDialog?.querySelectorAll("ul");
    expect(lists).toHaveLength(2);
    expect(lists?.[0]?.querySelectorAll(":scope > li")).toHaveLength(1);
    expect(lists?.[1]?.querySelectorAll(":scope > li")).toHaveLength(1);
    const newConfigItem = Array.from(
      menuDialog?.querySelectorAll<HTMLButtonElement>("button") ?? []
    ).find((button) => button.textContent === "New annotation config");
    expect(newConfigItem?.textContent).toBe("New annotation config");

    await act(async () => user.click(newConfigItem!));
    expect(document.body.textContent).toContain("Add annotation configuration");
  });

  it("uses a danger-on-hover minus button for project annotations", async () => {
    await renderAnnotationBar({ projectAnnotationConfigs: [annotationConfig] });
    const user = userEvent.setup();

    await act(async () => user.click(getAddAnnotationTrigger()));

    const removeButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Remove toxicity from project"]'
    );
    expect(removeButton?.dataset.variant).toBe("danger");
    expect(removeButton?.querySelector("path")?.getAttribute("d")).toBe(
      "M19 13H5a1 1 0 0 1 0-2h14a1 1 0 0 1 0 2z"
    );
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

    const removeButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Remove toxicity from project"]'
    );
    await act(async () => user.click(removeButton!));

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
