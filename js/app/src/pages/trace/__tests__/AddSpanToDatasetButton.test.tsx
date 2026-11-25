import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter } from "react-router";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { AddSpanToDatasetButton } from "../AddSpanToDatasetButton";

installTestMatchMedia();

// The dialog's query never resolves, so the dialog stays on its loading state
// and the test only covers that pressing the button opens it
function createPendingEnvironment() {
  return new Environment({
    network: Network.create(() => Observable.create(() => {})),
    store: new Store(new RecordSource()),
  });
}

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

function renderButton(): HTMLButtonElement {
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={createPendingEnvironment()}>
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <MemoryRouter>
            <AddSpanToDatasetButton spanId="U3Bhbjox" isCondensed />
          </MemoryRouter>
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Add to Dataset"]'
  );
  expect(button).not.toBeNull();
  return button!;
}

function getTooltipText() {
  return document.querySelector('[role="tooltip"]')?.textContent ?? null;
}

describe("AddSpanToDatasetButton", () => {
  it("names the icon-only button with a tooltip on keyboard focus", async () => {
    const user = userEvent.setup();
    const button = renderButton();

    await act(async () => user.tab());

    expect(document.activeElement).toBe(button);
    expect(getTooltipText()).toBe("Add to Dataset");

    await act(async () => button.blur());
  });

  it("opens the add to dataset dialog when the icon button is pressed", async () => {
    const user = userEvent.setup();
    const button = renderButton();

    expect(button.getAttribute("aria-expanded")).not.toBe("true");
    await act(async () => user.click(button));
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });
});
