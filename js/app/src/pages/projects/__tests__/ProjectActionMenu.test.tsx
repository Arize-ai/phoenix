import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { ProjectActionMenu } from "../ProjectActionMenu";

installTestMatchMedia();

function findButtonByText({ text }: { text: string }) {
  return Array.from(
    document.body.querySelectorAll<HTMLButtonElement>("button")
  ).find((element) => element.textContent?.trim() === text);
}

function findMenuItemByText({ text }: { text: string }) {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
  ).find((element) => element.textContent?.includes(text));
}

describe("ProjectActionMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderMenu({
    environment = createMockEnvironment(),
    projectId = "project-1",
    projectName = "alpha",
    onProjectClear = vi.fn(),
    onProjectDelete = vi.fn(),
    onProjectRemoveData = vi.fn(),
  }: {
    environment?: ReturnType<typeof createMockEnvironment>;
    projectId?: string;
    projectName?: string;
    onProjectClear?: () => void;
    onProjectDelete?: () => void;
    onProjectRemoveData?: () => void;
  } = {}) {
    act(() => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <ProjectActionMenu
              projectId={projectId}
              projectName={projectName}
              onProjectClear={onProjectClear}
              onProjectDelete={onProjectDelete}
              onProjectRemoveData={onProjectRemoveData}
            />
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
    return {
      environment,
      onProjectClear,
      onProjectDelete,
      onProjectRemoveData,
    };
  }

  async function openMenuAndSelect({ itemText }: { itemText: string }) {
    const triggerButton = container.querySelector("button");
    expect(triggerButton).not.toBeNull();
    await act(async () => {
      await userEvent.click(triggerButton as HTMLElement);
    });
    const menuItem = findMenuItemByText({ text: itemText });
    expect(menuItem).toBeDefined();
    await act(async () => {
      await userEvent.click(menuItem as HTMLElement);
    });
  }

  it("keeps the Clear dialog open while in flight, formats GraphQL errors inline, clears on reopen, and sets isClearingTraces on completion", async () => {
    const environment = createMockEnvironment();
    environment.commitUpdate((store) => {
      const projectRecord = store.create("project-1", "Project");
      projectRecord.setValue("project-1", "id");
      projectRecord.setValue(false, "isClearingTraces");
    });

    const { onProjectClear } = renderMenu({ environment });
    await openMenuAndSelect({ itemText: "Clear All Data" });

    const clearButton = findButtonByText({ text: "Clear" });
    expect(clearButton).toBeDefined();

    await act(async () => {
      await userEvent.click(clearButton as HTMLElement);
    });

    expect(document.body.textContent).toContain("Clear Project");
    expect(findButtonByText({ text: "Clear" })?.disabled).toBe(true);

    await act(async () => {
      environment.mock.rejectMostRecentOperation(
        new Error(
          `Error fetching GraphQL query 'ProjectActionMenuClearMutation': [{"message":"Another trace clear is already in progress for this project"}]`
        )
      );
    });

    expect(document.body.textContent).toContain(
      "Another trace clear is already in progress for this project"
    );
    expect(document.body.textContent).not.toContain(
      "Error fetching GraphQL query"
    );
    expect(onProjectClear).not.toHaveBeenCalled();

    await act(async () => {
      await userEvent.click(
        findButtonByText({ text: "Cancel" }) as HTMLElement
      );
    });
    await openMenuAndSelect({ itemText: "Clear All Data" });
    expect(document.body.textContent).not.toContain(
      "Another trace clear is already in progress for this project"
    );

    await act(async () => {
      await userEvent.click(findButtonByText({ text: "Clear" }) as HTMLElement);
    });
    await act(async () => {
      environment.mock.resolveMostRecentOperation({
        data: {
          clearProject: {
            node: {
              __typename: "Project",
              id: "project-1",
              isClearingTraces: true,
            },
          },
        },
      });
    });

    expect(onProjectClear).toHaveBeenCalledTimes(1);
    expect(
      environment.getStore().getSource().get("project-1")?.isClearingTraces
    ).toBe(true);
    expect(document.body.textContent).not.toContain("Clear Project");
  });

  it("displays formatted inline error in Delete Project dialog on 409 failure and clears on reopen", async () => {
    const { environment, onProjectDelete } = renderMenu();
    await openMenuAndSelect({ itemText: "Delete" });

    await act(async () => {
      await userEvent.click(
        findButtonByText({ text: "Delete Project" }) as HTMLElement
      );
    });

    expect(findButtonByText({ text: "Delete Project" })?.disabled).toBe(true);

    await act(async () => {
      environment.mock.rejectMostRecentOperation(
        new Error(
          `Error fetching GraphQL query 'ProjectActionMenuDeleteMutation': [{"message":"Cannot delete project while trace cleanup is running"}]`
        )
      );
    });

    expect(document.body.textContent).toContain(
      "Cannot delete project while trace cleanup is running"
    );
    expect(document.body.textContent).not.toContain(
      "Error fetching GraphQL query"
    );
    expect(onProjectDelete).not.toHaveBeenCalled();

    await act(async () => {
      await userEvent.click(
        findButtonByText({ text: "Cancel" }) as HTMLElement
      );
    });
    await openMenuAndSelect({ itemText: "Delete" });
    expect(document.body.textContent).not.toContain(
      "Cannot delete project while trace cleanup is running"
    );
  });

  it("displays formatted inline error in Remove Data dialog, clears on reopen, and sets isClearingTraces on completion", async () => {
    const environment = createMockEnvironment();
    environment.commitUpdate((store) => {
      const projectRecord = store.create("project-1", "Project");
      projectRecord.setValue("project-1", "id");
      projectRecord.setValue(false, "isClearingTraces");
    });

    const { onProjectRemoveData } = renderMenu({ environment });
    await openMenuAndSelect({ itemText: "Remove Data" });

    await act(async () => {
      await userEvent.click(
        findButtonByText({ text: "Remove Data" }) as HTMLElement
      );
    });

    await act(async () => {
      environment.mock.rejectMostRecentOperation(
        new Error(
          `Error fetching GraphQL query 'RemoveProjectDataFormMutation': [{"message":"Another trace clear is already in progress for this project"}]`
        )
      );
    });

    expect(document.body.textContent).toContain(
      "Another trace clear is already in progress for this project"
    );
    expect(document.body.textContent).not.toContain(
      "Error fetching GraphQL query"
    );
    expect(onProjectRemoveData).not.toHaveBeenCalled();

    const closeButton = document.body.querySelector(
      '[data-testid="dialog-close-button"]'
    );
    expect(closeButton).not.toBeNull();
    await act(async () => {
      await userEvent.click(closeButton as HTMLElement);
    });

    await openMenuAndSelect({ itemText: "Remove Data" });
    expect(document.body.textContent).not.toContain(
      "Another trace clear is already in progress for this project"
    );

    await act(async () => {
      await userEvent.click(
        findButtonByText({ text: "Remove Data" }) as HTMLElement
      );
    });
    await act(async () => {
      environment.mock.resolveMostRecentOperation({
        data: {
          clearProject: {
            node: {
              __typename: "Project",
              id: "project-1",
              isClearingTraces: true,
            },
          },
        },
      });
    });

    expect(onProjectRemoveData).toHaveBeenCalledTimes(1);
    expect(
      environment.getStore().getSource().get("project-1")?.isClearingTraces
    ).toBe(true);
  });
});
