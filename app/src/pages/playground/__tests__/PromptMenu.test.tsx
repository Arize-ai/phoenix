import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import {
  PromptVersionSelector,
  type PromptData,
} from "@phoenix/pages/playground/PromptMenu";

describe("PromptVersionSelector", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    vi.restoreAllMocks();
  });

  it("omits the description row when a prompt version has no description", async () => {
    const versionWithoutDescription = {
      id: "version-123456",
      createdAt: "2026-07-10T12:00:00.000Z",
      description: null,
      isLatest: true,
      tags: [],
    } as const;
    const prompt: PromptData = {
      id: "prompt-1",
      name: "test-prompt",
      versionTags: [],
      versions: [
        versionWithoutDescription,
        {
          id: "version-654321",
          createdAt: "2026-07-09T12:00:00.000Z",
          description: "Updated the system message",
          isLatest: false,
          tags: [],
        },
      ],
    };

    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PreferencesProvider>
            <PromptVersionSelector
              prompt={prompt}
              selectedVersionInfo={versionWithoutDescription}
              selectedTagName={null}
              onSelectVersion={vi.fn()}
              onSelectTag={vi.fn()}
            />
          </PreferencesProvider>
        </ThemeProvider>
      );
    });

    const menuTrigger =
      container.querySelector<HTMLButtonElement>("button.right-child");
    expect(menuTrigger).not.toBeNull();
    await act(async () => {
      menuTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.body.textContent).toContain("123456");
    expect(document.body.textContent).toContain("Updated the system message");
    expect(document.body.textContent).not.toContain("No change description");
  });
});
