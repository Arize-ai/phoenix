import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { SECRET_KEY_LEADING_AND_TRAILING_MESSAGE } from "@phoenix/constants";
import { ThemeProvider } from "@phoenix/contexts";

import { SecretMutationForm } from "../SecretMutationForm";

installTestMatchMedia();

describe("SecretMutationForm", () => {
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
          <SecretMutationForm
            submitLabel="Save"
            isSubmitting={false}
            onSubmit={onSubmit}
          />
        </ThemeProvider>
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("does not show an error for a trailing underscore while typing", async () => {
    const keyInput = getKeyInput(container);
    await act(async () => {
      keyInput.focus();
      typeInto({ input: keyInput, value: "openai " });
    });
    expect(keyInput.value).toBe("OPENAI_");
    expect(container.textContent).not.toContain(
      SECRET_KEY_LEADING_AND_TRAILING_MESSAGE
    );
    expect(keyInput.getAttribute("aria-invalid")).not.toBe("true");
  });

  it("trims the trailing underscore on blur and shows no error", async () => {
    const keyInput = getKeyInput(container);
    await act(async () => {
      keyInput.focus();
      typeInto({ input: keyInput, value: "openai api key " });
    });
    await act(async () => {
      keyInput.blur();
    });
    expect(keyInput.value).toBe("OPENAI_API_KEY");
    expect(container.textContent).not.toContain(
      SECRET_KEY_LEADING_AND_TRAILING_MESSAGE
    );
  });

  it("drops leading underscores as the key is typed", async () => {
    const keyInput = getKeyInput(container);
    await act(async () => {
      keyInput.focus();
      typeInto({ input: keyInput, value: "_java_options" });
    });
    expect(keyInput.value).toBe("JAVA_OPTIONS");
  });

  it("shows the error for a key starting with a digit only after blur", async () => {
    const keyInput = getKeyInput(container);
    await act(async () => {
      keyInput.focus();
      typeInto({ input: keyInput, value: "9lives" });
    });
    expect(container.querySelector('[slot="errorMessage"]')).toBeNull();
    expect(keyInput.getAttribute("aria-invalid")).not.toBe("true");

    await act(async () => {
      keyInput.blur();
    });
    expect(keyInput.getAttribute("aria-invalid")).toBe("true");
  });

  it("does not submit a key ending in an underscore", async () => {
    const keyInput = getKeyInput(container);
    const valueInput = container.querySelector<HTMLInputElement>(
      'input[type="password"], input[name="value"]'
    );
    expect(valueInput).not.toBeNull();
    await act(async () => {
      keyInput.focus();
      typeInto({ input: keyInput, value: "openai " });
    });
    await act(async () => {
      typeInto({ input: valueInput!, value: "secret" });
    });
    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(
          new SubmitEvent("submit", { bubbles: true, cancelable: true })
        );
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      SECRET_KEY_LEADING_AND_TRAILING_MESSAGE
    );
  });
});

function getKeyInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[placeholder="e.g. OPENAI_API_KEY"]'
  );
  expect(input).not.toBeNull();
  return input!;
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
