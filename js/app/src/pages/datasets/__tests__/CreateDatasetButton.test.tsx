import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import type { NotificationQueue } from "@phoenix/contexts";
import {
  createToastQueue,
  ThemeProvider,
  ToastQueueProvider,
} from "@phoenix/contexts";

import { CreateDatasetButton } from "../CreateDatasetButton";

installTestMatchMedia();
installTestStorage();

const DATASET_NODE_ID = "RGF0YXNldDox";
const DATASET_NAME = "golden-set";

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
});

function renderCreateDatasetButton({
  examplesLoader,
}: { examplesLoader?: () => Promise<null> } = {}) {
  const environment = createMockEnvironment();
  const queue = createToastQueue();
  const router = createMemoryRouter(
    [
      { path: "/datasets", element: <CreateDatasetButton /> },
      {
        path: "/datasets/:datasetId/examples",
        element: null,
        loader: examplesLoader,
      },
    ],
    { initialEntries: ["/datasets"] }
  );
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <ToastQueueProvider queue={queue}>
          <ThemeProvider themeMode="dark">
            <RouterProvider router={router} />
          </ThemeProvider>
        </ToastQueueProvider>
      </RelayEnvironmentProvider>
    );
  });
  return { environment, queue, router };
}

function getToasts(queue: NotificationQueue) {
  return queue.visibleToasts.map((toast) => toast.content);
}

function getByText<T extends HTMLElement>({
  selector,
  text,
}: {
  selector: string;
  text: string;
}): T {
  const element = Array.from(document.querySelectorAll<T>(selector)).find(
    (candidate) => candidate.textContent?.trim() === text
  );
  if (!element) {
    throw new Error(`Expected a ${selector} with the text "${text}"`);
  }
  return element;
}

async function submitDatasetFromScratch(): Promise<void> {
  const user = userEvent.setup();
  await act(async () =>
    user.click(getByText({ selector: "button", text: "New Dataset" }))
  );
  await act(async () =>
    user.click(getByText({ selector: "[role='tab']", text: "From scratch" }))
  );
  const nameInput = document.querySelector<HTMLInputElement>(
    "input[placeholder='e.x. Golden Dataset']"
  );
  if (!nameInput) {
    throw new Error("Expected the form to render a dataset name input");
  }
  await act(async () => user.type(nameInput, DATASET_NAME));
  await act(async () =>
    user.click(getByText({ selector: "button", text: "Create Dataset" }))
  );
}

function resolveCreateDataset(
  environment: ReturnType<typeof createMockEnvironment>
) {
  return act(async () => {
    environment.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        Dataset: () => ({ id: DATASET_NODE_ID, name: DATASET_NAME }),
      })
    );
  });
}

describe("CreateDatasetButton", () => {
  it("keeps the dialog open until the new dataset page has loaded", async () => {
    let finishLoading: () => void = () => {};
    const examplesLoader = () =>
      new Promise<null>((resolve) => {
        finishLoading = () => resolve(null);
      });
    const { environment, router } = renderCreateDatasetButton({
      examplesLoader,
    });
    await submitDatasetFromScratch();
    await resolveCreateDataset(environment);

    expect(router.state.location.pathname).toBe("/datasets");
    expect(router.state.navigation.state).toBe("loading");
    const submitButton = getByText<HTMLButtonElement>({
      selector: "button",
      text: "Creating...",
    });
    expect(submitButton.disabled).toBe(true);
    expect(document.querySelector("[data-testid='dialog']")).not.toBeNull();

    await act(async () => finishLoading());

    expect(router.state.location.pathname).toBe(
      `/datasets/${DATASET_NODE_ID}/examples`
    );
  });

  it("opens the new dataset once it is created", async () => {
    const { environment, queue, router } = renderCreateDatasetButton();
    await submitDatasetFromScratch();
    await resolveCreateDataset(environment);

    expect(router.state.location.pathname).toBe(
      `/datasets/${DATASET_NODE_ID}/examples`
    );
    expect(getToasts(queue)).toEqual([
      {
        title: "Dataset created",
        message: `${DATASET_NAME} has been successfully created.`,
        variant: "success",
      },
    ]);
  });
});
