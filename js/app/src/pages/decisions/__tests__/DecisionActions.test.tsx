import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { DeleteDecisionButton, SetDecisionTagButton } from "../DecisionActions";

const { commit } = vi.hoisted(() => ({ commit: vi.fn() }));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useMutation: () => [commit, false],
}));

describe("decision library actions", () => {
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

  it("keeps destructive confirmation hidden until opened, and cancel makes no mutation", async () => {
    const onDeleted = vi.fn();
    await render(
      <DeleteDecisionButton
        decisionId="decision-1"
        name="judge"
        onDeleted={onDeleted}
      />
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).not.toContain("cannot be undone");
    await clickButton("Delete judge");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("cannot be undone");
    await clickButton("Cancel");
    expect(commit).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("keeps GraphQL failures visible without reporting deletion", async () => {
    const onDeleted = vi.fn();
    await render(
      <DeleteDecisionButton
        decisionId="decision-1"
        name="judge"
        onDeleted={onDeleted}
      />
    );
    await clickButton("Delete judge");
    await clickButton("Delete decision");
    const options = commit.mock.calls[0][0];
    expect(options.variables).toEqual({ id: "decision-1" });
    await act(async () =>
      options.onCompleted({}, [{ message: "Decision is in use" }])
    );
    expect(document.body.textContent).toContain("Decision is in use");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("refreshes the library only after a successful deletion", async () => {
    const onDeleted = vi.fn();
    await render(
      <DeleteDecisionButton
        decisionId="decision-1"
        name="judge"
        onDeleted={onDeleted}
      />
    );
    await clickButton("Delete judge");
    await clickButton("Delete decision");
    expect(onDeleted).not.toHaveBeenCalled();
    await act(async () => commit.mock.calls[0][0].onCompleted({}, null));
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("rejects an empty tag before submitting a mutation", async () => {
    await render(
      <SetDecisionTagButton
        versionId="version-1"
        tagNames={[]}
        onSaved={vi.fn()}
      />
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await clickButton("Set version tag");
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () =>
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      )
    );
    expect(document.body.textContent).toContain("Cannot be empty");
    expect(commit).not.toHaveBeenCalled();
  });
});
