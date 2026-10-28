import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { DeleteDecisionVersionTagButton } from "../DeleteDecisionVersionTagButton";

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

describe("DeleteDecisionVersionTagButton", () => {
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

  it("keeps the confirmation hidden until opened, and cancel makes no mutation", async () => {
    const onDeleted = vi.fn();
    await render(
      <DeleteDecisionVersionTagButton tagId="tag-1" onDeleted={onDeleted} />
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await clickButton("Delete tag");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain(
      "pulling decisions by this tag"
    );
    await clickButton("Cancel");
    expect(commit).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("reports a GraphQL failure without refreshing", async () => {
    const onDeleted = vi.fn();
    await render(
      <DeleteDecisionVersionTagButton tagId="tag-1" onDeleted={onDeleted} />
    );
    await clickButton("Delete tag");
    await clickButton("Delete Tag");
    expect(commit).toHaveBeenCalledOnce();
    const options = commit.mock.calls[0][0];
    expect(options.variables).toEqual({ id: "tag-1" });
    await act(async () =>
      options.onCompleted({}, [{ message: "Tag is in use" }])
    );
    expect(notifyError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Tag is in use" })
    );
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("refreshes only after a successful deletion", async () => {
    const onDeleted = vi.fn();
    await render(
      <DeleteDecisionVersionTagButton tagId="tag-1" onDeleted={onDeleted} />
    );
    await clickButton("Delete tag");
    await clickButton("Delete Tag");
    expect(onDeleted).not.toHaveBeenCalled();
    await act(async () => commit.mock.calls[0][0].onCompleted({}, null));
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(notifySuccess).toHaveBeenCalledOnce();
  });
});
