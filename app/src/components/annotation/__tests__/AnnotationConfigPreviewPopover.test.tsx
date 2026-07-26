import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { DetailPanelAnnotationBar } from "@phoenix/components/annotation/DetailPanelAnnotationBar";
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

  async function renderAnnotationBar() {
    const successfulMutation = async () => ({ success: true }) as const;
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <DetailPanelAnnotationBar
              rows={[
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
              ]}
              allAnnotationConfigs={[annotationConfig]}
              projectAnnotationConfigs={[]}
              onAddAnnotationConfigToProject={successfulMutation}
              onCreateAnnotation={successfulMutation}
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
      '[aria-label="Open Add annotation annotation"]'
    );
    if (!trigger) {
      throw new Error("Add annotation trigger was not rendered");
    }
    return trigger;
  }

  function getConfigTrigger() {
    const trigger = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === annotationConfig.name
    );
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

    await act(async () => user.hover(firstConfigTrigger));
    expect(getPreview()).not.toBeNull();

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
});
