import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";
import {
  createToastQueue,
  ToastQueueProvider,
} from "@phoenix/contexts/NotificationContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ExperimentActionMenu } from "../ExperimentActionMenu";

describe("ExperimentActionMenu edits", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("notifies the collection owner after saving an experiment edit", async () => {
    const onExperimentEdited = vi.fn();
    const environment = createMockEnvironment();
    const queue = createToastQueue();
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <RelayEnvironmentProvider environment={environment}>
            <ToastQueueProvider queue={queue}>
              <CredentialsProvider>
                <MemoryRouter>
                  <ExperimentActionMenu
                    experimentId="experiment-1"
                    metadata={{}}
                    canDeleteExperiment={false}
                    canEditExperiment
                    experimentName="original"
                    experimentDescription={null}
                    onExperimentEdited={onExperimentEdited}
                  />
                </MemoryRouter>
              </CredentialsProvider>
            </ToastQueueProvider>
          </RelayEnvironmentProvider>
        </ThemeProvider>
      );
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Experiment action menu"]'
        )!
        .click();
    });
    const editItem = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((item) => item.textContent?.trim() === "Edit");
    expect(editItem).toBeDefined();
    await act(async () => editItem!.click());
    const input = document.querySelector<HTMLInputElement>(
      '[role="dialog"] input'
    )!;
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!.call(input, "updated");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const saveButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')
    ).find((button) => button.textContent?.trim() === "Save")!;
    expect(saveButton.disabled).toBe(false);
    expect(onExperimentEdited).not.toHaveBeenCalled();
    await act(async () => saveButton.click());
    expect(environment.mock.getAllOperations()).toHaveLength(1);
    expect(saveButton.textContent).toBe("Saving...");
    expect(onExperimentEdited).not.toHaveBeenCalled();
    await act(async () => {
      environment.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation, {
          Experiment: () => ({
            id: "experiment-1",
            name: "updated",
            description: null,
          }),
        })
      );
    });
    expect(onExperimentEdited).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
