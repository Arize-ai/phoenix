import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import { IDENTIFIER_ERROR_MESSAGES } from "@phoenix/utils/identifierUtils";

import { TagDecisionVersionButton } from "../TagDecisionVersionButton";

const { commit, notifySuccess, notifyError } = vi.hoisted(() => ({
  commit: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useMutation: () => [commit, false],
}));
vi.mock("@phoenix/contexts", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotifySuccess: () => notifySuccess,
  useNotifyError: () => notifyError,
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

  async function clickButton(label: string) {
    const button = Array.from(document.querySelectorAll("button")).find(
      (button) =>
        button.getAttribute("aria-label") === label ||
        button.textContent?.trim() === label
    );
    expect(button, `Button ${label} should be present`).toBeDefined();
    await act(async () => button?.click());
  }

  function checkboxes() {
    return Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    );
  }

  it("lists the default tags and the decision's own, with this version's checked", async () => {
    await render(
      <TagDecisionVersionButton
        versionId="version-1"
        decisionTagNames={["canary"]}
        versionTagNames={["canary"]}
        onTagSet={vi.fn()}
      />
    );
    expect(checkboxes()).toHaveLength(0);
    await clickButton("Tag Version");
    const byName = Object.fromEntries(
      checkboxes().map((checkbox) => [checkbox.name, checkbox])
    );
    expect(Object.keys(byName)).toEqual([
      "production",
      "staging",
      "development",
      "canary",
    ]);
    expect(byName.canary.checked).toBe(true);
    expect(byName.canary.disabled).toBe(true);
    expect(byName.production.checked).toBe(false);
  });

  it("sets a default tag with its description and refreshes only on success", async () => {
    const onTagSet = vi.fn();
    await render(
      <TagDecisionVersionButton
        versionId="version-1"
        decisionTagNames={[]}
        versionTagNames={[]}
        onTagSet={onTagSet}
      />
    );
    await clickButton("Tag Version");
    const production = checkboxes().find(
      (checkbox) => checkbox.name === "production"
    );
    await act(async () => production?.click());
    expect(commit).toHaveBeenCalledOnce();
    const options = commit.mock.calls[0][0];
    expect(options.variables).toEqual({
      versionId: "version-1",
      name: "production",
      description: "The version deployed to production",
    });
    await act(async () =>
      options.onCompleted({}, [{ message: "Tag is reserved" }])
    );
    expect(onTagSet).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Tag is reserved" })
    );
    await act(async () => options.onCompleted({}, null));
    expect(onTagSet).toHaveBeenCalledOnce();
    expect(notifySuccess).toHaveBeenCalledOnce();
  });

  it("opens the new tag dialog and sends a blank description as null", async () => {
    await render(
      <TagDecisionVersionButton
        versionId="version-1"
        decisionTagNames={[]}
        versionTagNames={[]}
        onTagSet={vi.fn()}
      />
    );
    await clickButton("Tag Version");
    await clickButton("New Tag");
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("New Decision Tag");
    const nameInput = dialog?.querySelector<HTMLInputElement>("input");
    expect(nameInput).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    await act(async () => {
      setter?.call(nameInput, "canary");
      nameInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await clickButton("Create Tag");
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0][0].variables).toEqual({
      versionId: "version-1",
      name: "canary",
      description: null,
    });
  });
  it("rejects an empty tag name before submitting a mutation", async () => {
    await render(
      <TagDecisionVersionButton
        versionId="version-1"
        decisionTagNames={[]}
        versionTagNames={[]}
        onTagSet={vi.fn()}
      />
    );
    await clickButton("Tag Version");
    await clickButton("New Tag");
    const form = document.querySelector('[role="dialog"] form');
    expect(form).not.toBeNull();
    await act(async () =>
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      )
    );
    expect(document.body.textContent).toContain(
      IDENTIFIER_ERROR_MESSAGES.empty
    );
    expect(commit).not.toHaveBeenCalled();
  });
});
