import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";

import type { PromptMenuValue } from "../PromptMenu";
import { PromptMenu } from "../PromptMenu";

installTestMatchMedia();
installTestStorage();

const PROMPT_ID = "UHJvbXB0OjE=";
const PROMPT_VERSION_ID = "UHJvbXB0VmVyc2lvbjox";

function createTestEnvironment() {
  const environment = createMockEnvironment();
  environment.mock.queueOperationResolver((operation) =>
    MockPayloadGenerator.generate(operation, {
      Prompt: () => ({
        __typename: "Prompt",
        id: PROMPT_ID,
        name: "my-prompt",
        versionTags: [],
      }),
      PromptVersion: () => ({
        id: PROMPT_VERSION_ID,
        createdAt: "2026-01-01T00:00:00.000Z",
        description: null,
        tags: [],
      }),
      // Product queries carry no scalar type info, so booleans reach the
      // String resolver; key them by schema field name
      String: ({ name }) => (name === "isLatest" ? true : undefined),
    })
  );
  return environment;
}

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

async function renderPromptMenu({
  value,
  onChange,
}: {
  value: PromptMenuValue | null;
  onChange: (changes: {
    promptId: string | null;
    promptVersionId: string | null;
    promptTagName: string | null;
  }) => void;
}) {
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={createTestEnvironment()}>
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PreferencesProvider>
            <Suspense fallback={<div>loading</div>}>
              <PromptMenu value={value} onChange={onChange} />
            </Suspense>
          </PreferencesProvider>
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });
}

function findDetachButton() {
  return container.querySelector<HTMLButtonElement>(
    'button[aria-label="Detach prompt"]'
  );
}

describe("PromptMenu", () => {
  it("does not offer to detach when no prompt is loaded", async () => {
    await renderPromptMenu({ value: null, onChange: vi.fn() });

    expect(container.textContent).toContain("Select a prompt");
    expect(findDetachButton()).toBeNull();
  });

  it("clears the prompt selection when detach is pressed", async () => {
    const onChange = vi.fn();
    await renderPromptMenu({
      value: {
        promptId: PROMPT_ID,
        promptVersionId: PROMPT_VERSION_ID,
        promptTagName: null,
      },
      onChange,
    });

    expect(container.textContent).toContain("my-prompt");
    const detachButton = findDetachButton();
    expect(detachButton).not.toBeNull();

    await act(async () => {
      detachButton!.click();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      promptId: null,
      promptVersionId: null,
      promptTagName: null,
    });
  });
});
