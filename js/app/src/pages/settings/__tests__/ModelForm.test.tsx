import type { ComponentProps } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import type { ModelFormParams } from "../ModelForm";
import { ModelForm } from "../ModelForm";

describe("ModelForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSubmit = vi.fn<(params: ModelFormParams) => void>();

  const renderForm = (props: Partial<ComponentProps<typeof ModelForm>> = {}) =>
    act(async () => {
      root.render(
        <ThemeProvider themeMode="dark">
          <RelayEnvironmentProvider environment={createMockEnvironment()}>
            <ModelForm
              // Remount so the form takes the new default values
              key={JSON.stringify(props)}
              modelName="my-model"
              modelNamePattern="^my-model$"
              onSubmit={onSubmit}
              isSubmitting={false}
              submitButtonText="Create Model"
              formMode="create"
              {...props}
            />
          </RelayEnvironmentProvider>
        </ThemeProvider>
      );
    });

  beforeEach(async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    onSubmit.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await renderForm();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
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
  const costTableTitles = () =>
    Array.from(container.querySelectorAll("h3")).map(
      (heading) => heading.textContent
    );
  const selectModelType = async (from: string, to: string) => {
    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === from
      )!
    );
    await click(
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('[role="option"]')
      ).find((option) => option.textContent === to)!
    );
  };
  // The suggestions shown for a token type input once its text is cleared
  const tokenTypeSuggestions = async (input: HTMLInputElement) => {
    await act(async () => {
      await userEvent.clear(input);
      await userEvent.type(input, "{arrowdown}");
    });
    return Array.from(document.querySelectorAll('[role="option"]')).map(
      (option) => option.textContent
    );
  };
  const duplicateErrorCount = () =>
    container.textContent?.match(/Duplicate token type/g)?.length ?? 0;

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

  it("submits known token types in lowercase", async () => {
    await replaceText(promptTokenTypeInput(), "Input");
    await submit();

    expect(onSubmit.mock.calls[0][0].promptCosts[0].tokenType).toBe("input");
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

  it("does not validate the hidden completion rows of an embedding model", async () => {
    const completionTable = () => container.querySelectorAll("table")[1];
    await click(
      Array.from(completionTable().querySelectorAll("button")).find(
        (button) => button.textContent === "Add row"
      )!
    );
    await selectModelType("LLM", "Embedding");
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].completionCosts).toEqual([]);
  });

  it("flags, but keeps, prompt prices an embedding model never uses", async () => {
    const unusedHint = /will not be used/;
    await addPromptRow();
    await replaceText(promptRowTokenTypeInput(1), "cache_read");
    await selectModelType("LLM", "Embedding");

    expect(container.textContent).toMatch(unusedHint);
    expect(container.textContent).toContain("cache_read will not be used");
    expect(promptRows()).toHaveLength(2);

    await selectModelType("Embedding", "LLM");
    expect(container.textContent).not.toMatch(unusedHint);
    expect(promptRowTokenTypeInput(1).value).toBe("cache_read");

    await selectModelType("LLM", "Embedding");
    await submit();
    expect(
      onSubmit.mock.calls[0][0].promptCosts.map((cost) => cost.tokenType)
    ).toEqual(["input", "cache_read"]);
  });

  it("adds an output row when an embedding model becomes another type", async () => {
    await renderForm({
      modelType: "EMBEDDING",
      modelCost: [
        { kind: "PROMPT", tokenType: "input", costPerMillionTokens: 0.02 },
      ],
    });
    expect(costTableTitles()).toEqual(["Input tokens"]);

    await selectModelType("Embedding", "Decision");

    expect(costTableTitles()).toEqual(["Input tokens", "Output tokens"]);
    await submit();
    const [params] = onSubmit.mock.calls[0];
    expect(params.modelType).toBe("DECISION");
    expect(params.completionCosts).toEqual([
      { kind: "COMPLETION", tokenType: "output", costPerMillionTokens: 0 },
    ]);
  });

  it("suggests only the token types a decision span reports", async () => {
    expect(await tokenTypeSuggestions(promptTokenTypeInput())).toEqual([
      "input",
      "audio",
      "cache_read",
      "cache_write",
    ]);
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });

    await selectModelType("LLM", "Decision");

    expect(await tokenTypeSuggestions(promptTokenTypeInput())).toEqual([
      "input",
      "cache_read",
      "cache_write",
    ]);
  });
});
