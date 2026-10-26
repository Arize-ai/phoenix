import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { TagDecisionVersionButton } from "../TagDecisionVersionButton";

const { commit } = vi.hoisted(() => ({ commit: vi.fn() }));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useMutation: () => [commit, false],
}));

describe("TagDecisionVersionButton", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(children: ReactNode) {
    await act(async () => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "dark",
            themeMode: "dark",
            systemTheme: "dark",
            setThemeMode: vi.fn(),
          }}
        >
          {children}
        </ThemeContext.Provider>
      );
    });
  }

  async function openDialog() {
    const button = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Tag Version"
    );
    expect(button, "The Tag Version button should be present").toBeDefined();
    await act(async () => button?.click());
  }

  async function submit() {
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () =>
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      )
    );
  }

  async function typeInto(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string
  ) {
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      "value"
    )?.set;
    await act(async () => {
      setter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("rejects an empty tag before submitting a mutation", async () => {
    await render(
      <TagDecisionVersionButton versionId="version-1" tagNames={[]} />
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await openDialog();
    await submit();
    expect(document.body.textContent).toContain("Cannot be empty");
    expect(commit).not.toHaveBeenCalled();
  });

  it("sends the tag's description, trimmed, when moving an existing tag", async () => {
    await render(
      <TagDecisionVersionButton versionId="version-1" tagNames={["staging"]} />
    );
    await openDialog();
    const nameInput = document.querySelector<HTMLInputElement>(
      '[role="dialog"] input'
    );
    const descriptionInput = document.querySelector<HTMLTextAreaElement>(
      '[role="dialog"] textarea'
    );
    expect(nameInput).not.toBeNull();
    expect(descriptionInput).not.toBeNull();
    await typeInto(nameInput!, "staging");
    expect(document.body.textContent).toContain(
      "Leave empty to keep the tag's description."
    );
    await typeInto(descriptionInput!, "  Release candidate  ");
    await submit();
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          versionId: "version-1",
          name: "staging",
          description: "Release candidate",
        },
      })
    );
  });
});
