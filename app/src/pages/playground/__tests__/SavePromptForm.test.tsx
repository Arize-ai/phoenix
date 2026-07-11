import { act, Suspense, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SavePromptForm } from "../SavePromptForm";

vi.mock("@phoenix/components/code", () => ({
  CodeEditorFieldWrapper: ({ children }: { children: ReactNode }) => children,
  JSONEditor: () => null,
}));

vi.mock("@phoenix/pages/playground/PromptComboBox", () => ({
  PromptComboBox: ({
    defaultInputValue,
    onBlur,
    onInputChange,
  }: {
    defaultInputValue?: string;
    onBlur?: () => void;
    onInputChange?: (value: string) => void;
  }) => (
    <input
      data-testid="prompt-picker"
      defaultValue={defaultInputValue}
      onBlur={onBlur}
      onChange={(event) => onInputChange?.(event.target.value)}
    />
  ),
}));

function createTestEnvironment({
  prompts = [],
}: {
  prompts?: { id: string; name: string }[];
}) {
  return new Environment({
    network: Network.create(() =>
      Observable.from({
        data: {
          prompts: {
            edges: prompts.map((prompt) => ({
              prompt: {
                __typename: "Prompt",
                ...prompt,
                versionTags: [],
              },
            })),
          },
        },
      })
    ),
    store: new Store(new RecordSource()),
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setValue?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SavePromptForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("creates a prompt without a description", async () => {
    const onCreate = vi.fn();

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={createTestEnvironment({})}>
          <Suspense fallback={null}>
            <SavePromptForm
              onCreate={onCreate}
              onUpdate={vi.fn()}
              onClose={vi.fn()}
            />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });

    const promptInput = container.querySelector<HTMLInputElement>(
      '[data-testid="prompt-picker"]'
    );
    expect(promptInput).not.toBeNull();

    await act(async () => {
      setInputValue(promptInput as HTMLInputElement, "new-prompt");
    });

    const submitButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="submit"]')
    ).find((button) => button.textContent === "Create Prompt");
    expect(submitButton).not.toBeUndefined();
    expect(submitButton?.disabled).toBe(false);
    expect(submitButton?.getAttribute("data-variant")).toBe("primary");

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true })
      );
    });

    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      name: "new-prompt",
      description: undefined,
    });
  });

  it("requires a change description when updating a prompt", async () => {
    const onUpdate = vi.fn();

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider
          environment={createTestEnvironment({
            prompts: [{ id: "prompt-1", name: "existing-prompt" }],
          })}
        >
          <Suspense fallback={null}>
            <SavePromptForm
              defaultSelectedPromptId="prompt-1"
              onCreate={vi.fn()}
              onUpdate={onUpdate}
              onClose={vi.fn()}
            />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true })
      );
    });

    expect(onUpdate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Description is required");
  });
});
