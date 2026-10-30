import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelFormParams } from "../ModelForm";
import { ModelForm } from "../ModelForm";

function createTestEnvironment() {
  return new Environment({
    network: Network.create(() =>
      Promise.resolve({
        data: {
          validateRegularExpression: { isValid: true, errorMessage: null },
        },
      })
    ),
    store: new Store(new RecordSource()),
  });
}

describe("ModelForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSubmit = vi.fn<(params: ModelFormParams) => void>();

  beforeEach(async () => {
    onSubmit.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={createTestEnvironment()}>
          <ModelForm
            modelName="my-model"
            modelNamePattern="^my-model$"
            onSubmit={onSubmit}
            isSubmitting={false}
            submitButtonText="Create Model"
            formMode="create"
          />
        </RelayEnvironmentProvider>
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const providerInput = () =>
    container.querySelector<HTMLInputElement>(
      'input[placeholder="Choose or enter a provider"]'
    )!;
  const promptTokenTypeInput = () =>
    container.querySelector<HTMLInputElement>(
      'input[aria-label="Token type"]'
    )!;
  const replaceText = (input: HTMLInputElement, text: string) =>
    act(async () => {
      await userEvent.clear(input);
      await userEvent.type(input, text);
    });
  const submit = () =>
    act(async () => {
      await userEvent.click(
        container.querySelector<HTMLButtonElement>('button[type="submit"]')!
      );
    });
  const click = (button: HTMLButtonElement) =>
    act(async () => {
      await userEvent.click(button);
    });
  const addPromptRow = () =>
    click(
      Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent === "Add row"
      )[0]
    );
  // The first table holds the prompt rows; its last row holds "Add row"
  const promptRows = () =>
    Array.from(
      container.querySelector("table")!.querySelectorAll("tbody > tr")
    ).slice(0, -1);
  const promptRowTokenTypeInput = (index: number) =>
    promptRows()[index].querySelector<HTMLInputElement>(
      'input[aria-label="Token type"]'
    )!;
  const removePromptRow = (index: number) =>
    click(
      promptRows()[index].querySelector<HTMLButtonElement>(
        "td:last-child button"
      )!
    );
  const duplicateErrorCount = () =>
    container.textContent?.match(/Duplicate token type/g)?.length ?? 0;

  it("keeps the case of a custom provider and token type", async () => {
    await replaceText(providerInput(), "AcmeAI");
    await replaceText(promptTokenTypeInput(), "CacheRead");
    expect(providerInput().value).toBe("AcmeAI");
    expect(promptTokenTypeInput().value).toBe("CacheRead");
  });

  it("trims outer whitespace on submit", async () => {
    await replaceText(providerInput(), "  Acme AI ");
    await replaceText(promptTokenTypeInput(), " CacheRead ");
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [params] = onSubmit.mock.calls[0];
    expect(params.provider).toBe("Acme AI");
    expect(params.promptCosts[0].tokenType).toBe("CacheRead");
  });

  it("rejects a token type made only of whitespace", async () => {
    await replaceText(promptTokenTypeInput(), "   ");
    await submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Token type is required");
  });

  it.each([
    ["OpenAI", "openai"],
    ["Azure OpenAI", "azure"],
    ["ANTHROPIC", "anthropic"],
  ])(
    "submits the typed provider %s as the preset value %s",
    async (typed, expected) => {
      await replaceText(providerInput(), typed);
      expect(providerInput().value).toBe(typed);
      await submit();

      expect(onSubmit.mock.calls[0][0].provider).toBe(expected);
    }
  );

  it("submits known token types in lowercase", async () => {
    await replaceText(promptTokenTypeInput(), "Input");
    await submit();

    expect(onSubmit.mock.calls[0][0].promptCosts[0].tokenType).toBe("input");
  });

  it("rejects a token type that duplicates another on the same side", async () => {
    await addPromptRow();
    await replaceText(promptRowTokenTypeInput(1), "INPUT");
    await submit();

    expect(onSubmit).not.toHaveBeenCalled();
    // Only the later row is flagged, since that is the one to fix
    expect(duplicateErrorCount()).toBe(1);
  });

  it("clears a duplicate error when the earlier row changes, without flagging empty rows", async () => {
    await addPromptRow();
    await replaceText(promptRowTokenTypeInput(1), "INPUT");
    await submit();
    expect(duplicateErrorCount()).toBe(1);

    await addPromptRow();
    await replaceText(promptRowTokenTypeInput(0), "audio");

    expect(duplicateErrorCount()).toBe(0);
    expect(container.textContent).not.toContain("Token type is required");
  });

  it("clears a duplicate error when the duplicated row is removed", async () => {
    await addPromptRow();
    await addPromptRow();
    await replaceText(promptRowTokenTypeInput(1), "cache_read");
    await replaceText(promptRowTokenTypeInput(2), "CACHE_READ");
    await submit();
    expect(duplicateErrorCount()).toBe(1);

    await removePromptRow(1);

    expect(promptRows()).toHaveLength(2);
    expect(duplicateErrorCount()).toBe(0);
  });
});
