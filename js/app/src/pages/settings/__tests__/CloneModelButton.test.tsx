import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  createToastQueue,
  ThemeProvider,
  ToastQueueProvider,
} from "@phoenix/contexts";

import { CloneModelButton } from "../CloneModelButton";

installTestMatchMedia();
installTestStorage();

const MODEL_ID = "R2VuZXJhdGl2ZU1vZGVsOjE=";

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

describe("CloneModelButton", () => {
  it("creates the clone with the type of the source model", async () => {
    const environment = createMockEnvironment();
    const router = createMemoryRouter(
      [{ path: "/", element: <CloneModelButton modelId={MODEL_ID} /> }],
      { initialEntries: ["/"] }
    );
    act(() => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ToastQueueProvider queue={createToastQueue()}>
            <ThemeProvider themeMode="dark">
              <RouterProvider router={router} />
            </ThemeProvider>
          </ToastQueueProvider>
        </RelayEnvironmentProvider>
      );
    });
    const user = userEvent.setup();
    const cloneButton = document.querySelector<HTMLButtonElement>(
      "button[aria-label='Clone model']"
    );
    if (!cloneButton) {
      throw new Error("Expected a clone model button");
    }
    await act(async () => user.click(cloneButton));
    await act(async () => {
      environment.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation, {
          Node: () => ({ __typename: "GenerativeModel" }),
          GenerativeModel: () => ({
            id: MODEL_ID,
            name: "gpt-6-luna",
            provider: "openai",
            namePattern: "gpt-6-luna",
            startTime: null,
            modelType: "DECISION",
            tokenPrices: [
              { tokenType: "input", kind: "PROMPT", costPerMillionTokens: 1 },
              {
                tokenType: "output",
                kind: "COMPLETION",
                costPerMillionTokens: 0,
              },
            ],
          }),
        })
      );
    });
    const submitButton = document.querySelector<HTMLButtonElement>(
      "button[type='submit']"
    );
    if (!submitButton) {
      throw new Error("Expected the clone form to render a submit button");
    }
    await act(async () => user.click(submitButton));

    const operation = environment.mock.getMostRecentOperation();
    expect(operation.request.node.params.name).toBe("CloneModelButtonMutation");
    expect(operation.request.variables.input.modelType).toBe("DECISION");
  });
});
