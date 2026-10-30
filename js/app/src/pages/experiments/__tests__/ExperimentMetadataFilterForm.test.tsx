import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { ExperimentMetadataFilterForm } from "../ExperimentMetadataFilterButton";

installTestMatchMedia();

describe("ExperimentMetadataFilterForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSubmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSubmit = vi.fn();
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <ExperimentMetadataFilterForm onSubmit={onSubmit} />
        </ThemeProvider>
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function getInput(label: string): HTMLInputElement {
    const labelElement = Array.from(container.querySelectorAll("label")).find(
      (element) => element.textContent === label
    );
    const input = labelElement?.htmlFor
      ? container.querySelector<HTMLInputElement>(
          `#${CSS.escape(labelElement.htmlFor)}`
        )
      : null;
    expect(input).not.toBeNull();
    return input!;
  }

  async function typeInto(label: string, text: string) {
    const input = getInput(label);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function submit() {
    const button = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent === "Add filter"
    );
    expect(button).toBeDefined();
    await act(async () => {
      button!.click();
    });
  }

  it("submits a nested key with a typed value", async () => {
    await typeInto("Key", "harbor_agent.model_params.temperature");
    await typeInto("Value", "0.7");
    await submit();
    expect(onSubmit).toHaveBeenCalledWith({
      path: ["harbor_agent", "model_params", "temperature"],
      value: 0.7,
    });
  });

  it("submits a quoted value as a string", async () => {
    await typeInto("Key", "stream");
    await typeInto("Value", '"true"');
    await submit();
    expect(onSubmit).toHaveBeenCalledWith({ path: ["stream"], value: "true" });
  });

  it("shows errors and doesn't submit when fields are blank", async () => {
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Enter a key");
    expect(container.textContent).toContain("Enter a value");
  });
});
