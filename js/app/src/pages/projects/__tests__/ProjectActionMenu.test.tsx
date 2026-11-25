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

  it("shows a Clear error inline and keeps the dialog open, then closes and notifies on success", async () => {
    const { environment, onProjectClear } = renderMenu();
    await openMenuAndSelect({ itemText: "Clear All Data" });

    await act(async () => {
      await userEvent.click(findButtonByText({ text: "Clear" }) as HTMLElement);
    });
    expect(findButtonByText({ text: "Clear" })?.disabled).toBe(true);

    await act(async () => {
      environment.mock.rejectMostRecentOperation(
        new Error(
          `Error fetching GraphQL query 'ProjectActionMenuClearMutation': [{"message":"Some traces are in use by another operation; run the clear again to finish."}]`
        )
      );
    });

    expect(document.body.textContent).toContain("Clear Project");
    expect(document.body.textContent).toContain(
      "Some traces are in use by another operation; run the clear again to finish."
    );
    expect(onProjectClear).toHaveBeenCalledTimes(1);
    expect(onProjectClear).toHaveBeenLastCalledWith({ didFail: true });

    await act(async () => {
      await userEvent.click(findButtonByText({ text: "Clear" }) as HTMLElement);
    });
    await act(async () => {
      environment.mock.resolveMostRecentOperation({
        data: { clearProject: { __typename: "Query" } },
      });
    });

    expect(onProjectClear).toHaveBeenCalledTimes(2);
    expect(onProjectClear).toHaveBeenLastCalledWith();
    expect(document.body.textContent).not.toContain("Clear Project");
  });

  it("shows a Delete Project error inline and keeps the dialog open", async () => {
    const { environment, onProjectDelete } = renderMenu();
    await openMenuAndSelect({ itemText: "Delete" });

    await act(async () => {
      await userEvent.click(
        findButtonByText({ text: "Delete Project" }) as HTMLElement
      );
    });
    expect(findButtonByText({ text: "Delete Project" })?.disabled).toBe(true);

    await act(async () => {
      environment.mock.resolveMostRecentOperation({
        data: { deleteProject: { __typename: "Query" } },
        errors: [{ message: "Cannot delete project while cleanup is running" }],
      });
    });

    expect(document.body.textContent).toContain(
      "Cannot delete project while cleanup is running"
    );
    expect(onProjectDelete).not.toHaveBeenCalled();
  });

  it("shows a Remove Data error inline, then closes and notifies on success", async () => {
    const { environment, onProjectRemoveData } = renderMenu();
    await openMenuAndSelect({ itemText: "Remove Data" });

    await act(async () => {
      await userEvent.click(
        findButtonByText({ text: "Remove Data" }) as HTMLElement
      );
    });
    await act(async () => {
      environment.mock.rejectMostRecentOperation(
        new Error(
          `Error fetching GraphQL query 'RemoveProjectDataFormMutation': [{"message":"Some traces are in use by another operation; run the clear again to finish."}]`
        )
      );
    });

    expect(document.body.textContent).toContain(
      "Some traces are in use by another operation; run the clear again to finish."
    );
    expect(onProjectRemoveData).toHaveBeenCalledWith({ didFail: true });

    await act(async () => {
      await userEvent.click(
        findButtonByText({ text: "Remove Data" }) as HTMLElement
      );
    });
    await act(async () => {
      environment.mock.resolveMostRecentOperation({
        data: { clearProject: { __typename: "Query" } },
      });
    });

    expect(onProjectRemoveData).toHaveBeenLastCalledWith();
  });
});
