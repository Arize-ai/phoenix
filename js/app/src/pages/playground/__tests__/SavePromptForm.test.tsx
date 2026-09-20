import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelayModule from "react-relay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

installTestMatchMedia();

const relayMocks = vi.hoisted(() => ({
  useLazyLoadQuery: vi.fn(),
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelayModule>()),
  useLazyLoadQuery: relayMocks.useLazyLoadQuery,
}));

vi.mock("@phoenix/components/code", () => ({
  CodeEditorFieldWrapper: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  JSONEditor: ({ value }: { value?: string }) => (
    <textarea data-testid="metadata-editor" value={value} readOnly />
  ),
}));

vi.mock("../PromptComboBox", () => ({
  PromptComboBox: ({
    onChange,
  }: {
    onChange: (promptId: string | null) => void;
  }) => (
    <>
      <button type="button" onClick={() => onChange("prompt-1")}>
        Select prompt
      </button>
      <button type="button" onClick={() => onChange(null)}>
        Clear prompt
      </button>
    </>
  ),
}));

import { SavePromptForm } from "../SavePromptForm";

const promptMetadata = {
  owner: "evaluation",
  revision: 2,
};

describe("SavePromptForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    relayMocks.useLazyLoadQuery.mockReturnValue({
      prompts: {
        edges: [
          {
            prompt: {
              id: "prompt-1",
              name: "Existing prompt",
              versionTags: [],
              version: { metadata: promptMetadata },
            },
          },
        ],
      },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("prefills metadata when selecting an existing prompt and resets it in create mode", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <SavePromptForm
            onCreate={vi.fn()}
            onUpdate={vi.fn()}
            onClose={vi.fn()}
          />
        </ThemeProvider>
      );
    });

    expect(getMetadataEditor(container).value).toBe("{}");

    await act(async () => {
      getButton(container, "Select prompt").click();
    });
    expect(getMetadataEditor(container).value).toBe(
      JSON.stringify(promptMetadata, null, 2)
    );

    await act(async () => {
      getButton(container, "Clear prompt").click();
    });
    expect(getMetadataEditor(container).value).toBe("{}");
  });
});

function getMetadataEditor(container: HTMLElement): HTMLTextAreaElement {
  const editor = container.querySelector<HTMLTextAreaElement>(
    '[data-testid="metadata-editor"]'
  );
  expect(editor).not.toBeNull();
  return editor!;
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label
  );
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}
