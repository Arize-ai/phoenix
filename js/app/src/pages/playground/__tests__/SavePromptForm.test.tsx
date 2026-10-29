import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelayModule from "react-relay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";
import { IDENTIFIER_ERROR_MESSAGES } from "@phoenix/utils/identifierUtils";

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
  JSONEditor: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange: (value: string) => void;
  }) => (
    <>
      <textarea data-testid="metadata-editor" value={value} readOnly />
      <button type="button" onClick={() => onChange('{"owner":"unsaved"}')}>
        Edit metadata
      </button>
    </>
  ),
}));

vi.mock("../PromptComboBox", () => ({
  PromptComboBox: ({
    onChange,
    inputValue,
    onInputChange,
  }: {
    onChange: (promptId: string | null) => void;
    inputValue?: string;
    onInputChange?: (value: string) => void;
  }) => (
    <>
      <input
        aria-label="Prompt name"
        value={inputValue ?? ""}
        onChange={(event) => onInputChange?.(event.target.value)}
      />
      <button type="button" onClick={() => onChange("prompt-1")}>
        Select prompt
      </button>
      <button type="button" onClick={() => onChange("prompt-2")}>
        Select second prompt
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
          {
            prompt: {
              id: "prompt-2",
              name: "Second prompt",
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

  it("resets unsaved metadata when selecting a different prompt with the same metadata", async () => {
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

    await act(async () => {
      getButton(container, "Select prompt").click();
    });
    await act(async () => {
      getButton(container, "Edit metadata").click();
    });
    expect(getMetadataEditor(container).value).toBe('{"owner":"unsaved"}');

    await act(async () => {
      getButton(container, "Select second prompt").click();
    });
    expect(getMetadataEditor(container).value).toBe(
      JSON.stringify(promptMetadata, null, 2)
    );
  });

  it("converts spaces to dashes as the prompt name is typed", async () => {
    await renderSavePromptForm(root);

    await act(async () => {
      typeInto(getPromptNameInput(container), "my prompt");
    });
    expect(getPromptNameInput(container).value).toBe("my-prompt");
  });

  it("fills the prompt name when selecting an existing prompt", async () => {
    await renderSavePromptForm(root);

    await act(async () => {
      getButton(container, "Select prompt").click();
    });
    expect(getPromptNameInput(container).value).toBe("Existing prompt");
  });

  it("restores the prompt name when the selected prompt is sent again", async () => {
    await renderSavePromptForm(root);

    await act(async () => {
      getButton(container, "Select prompt").click();
    });
    await act(async () => {
      typeInto(getPromptNameInput(container), "Existing");
    });
    // The ComboBox sends the selected key again to revert an edit, e.g. on Escape
    await act(async () => {
      getButton(container, "Select prompt").click();
    });
    expect(getPromptNameInput(container).value).toBe("Existing prompt");
    expect(getButton(container, "Update Prompt")).toBeDefined();
  });

  it("keeps a typed name when the prompt is deselected", async () => {
    await renderSavePromptForm(root);

    await act(async () => {
      getButton(container, "Select prompt").click();
    });
    await act(async () => {
      typeInto(getPromptNameInput(container), "new name");
    });
    await act(async () => {
      getButton(container, "Clear prompt").click();
    });
    expect(getPromptNameInput(container).value).toBe("new-name");
    expect(getButton(container, "Create Prompt")).toBeDefined();
  });

  it("waits for blur to flag a trailing dash in a new tag name", async () => {
    await renderSavePromptForm(root);
    const tagInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="New tag name"]'
    )!;

    await act(async () => {
      tagInput.focus();
      typeInto(tagInput, "my ");
    });
    expect(tagInput.value).toBe("my-");
    expect(container.textContent).not.toContain(
      IDENTIFIER_ERROR_MESSAGES.leadingTrailing
    );

    await act(async () => {
      tagInput.blur();
    });
    expect(container.textContent).toContain(
      IDENTIFIER_ERROR_MESSAGES.leadingTrailing
    );
  });
});

async function renderSavePromptForm(root: Root) {
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
}

function getPromptNameInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Prompt name"]'
  );
  expect(input).not.toBeNull();
  return input!;
}

/**
 * Sets the value the way a browser does, so React's onChange fires.
 */
function typeInto(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

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
