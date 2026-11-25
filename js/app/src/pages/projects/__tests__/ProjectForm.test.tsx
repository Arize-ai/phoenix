import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { URI_SAFE_LEADING_AND_TRAILING_MESSAGE } from "@phoenix/constants";
import { ThemeProvider } from "@phoenix/contexts";

import { ProjectForm } from "../ProjectForm";

installTestMatchMedia();

describe("ProjectForm name field", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSubmit: ReturnType<typeof vi.fn<(params: unknown) => void>>;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSubmit = vi.fn();
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <ProjectForm
            onSubmit={onSubmit}
            isSubmitting={false}
            submitButtonText="Create"
          />
        </ThemeProvider>
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("drops leading separators and keeps a trailing one while typing", async () => {
    const nameInput = getNameInput(container);
    await act(async () => {
      nameInput.focus();
      typeInto({ input: nameInput, value: " -My Café Project " });
    });
    expect(nameInput.value).toBe("My-Cafe-Project-");
    expect(container.textContent).not.toContain(
      URI_SAFE_LEADING_AND_TRAILING_MESSAGE
    );
  });

  it("trims trailing separators on blur and submits the trimmed name", async () => {
    const nameInput = getNameInput(container);
    await act(async () => {
      nameInput.focus();
      typeInto({ input: nameInput, value: "my project." });
    });
    await act(async () => {
      nameInput.blur();
    });
    expect(nameInput.value).toBe("my-project");

    await act(async () => {
      getButton(container, "Create").click();
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "my-project" })
    );
  });

  it("does not submit a name ending in a separator", async () => {
    const nameInput = getNameInput(container);
    await act(async () => {
      nameInput.focus();
      typeInto({ input: nameInput, value: "my project " });
    });
    expect(nameInput.value).toBe("my-project-");

    await act(async () => {
      getButton(container, "Create").click();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      URI_SAFE_LEADING_AND_TRAILING_MESSAGE
    );
  });
});

function getNameInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[placeholder="e.x. my-ai-project"]'
  );
  expect(input).not.toBeNull();
  return input!;
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label
  );
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

/**
 * Sets the value the way a browser does, so React's onChange fires.
 */
function typeInto({
  input,
  value,
}: {
  input: HTMLInputElement;
  value: string;
}) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
