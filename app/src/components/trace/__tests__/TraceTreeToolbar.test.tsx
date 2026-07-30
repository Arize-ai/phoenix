import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { TraceTreeTimingToggleButton } from "../TraceTreeToolbar";

describe("TraceTreeTimingToggleButton", () => {
  installTestMatchMedia();

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

  it("toggles the shared trace-tree timing preference", async () => {
    act(() => {
      root.render(
        <ThemeProvider>
          <PreferencesProvider showMetricsInTraceTree={false}>
            <TraceTreeTimingToggleButton />
          </PreferencesProvider>
        </ThemeProvider>
      );
    });

    const user = userEvent.setup();
    const showTimingButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show metrics in trace tree"]'
    );
    expect(showTimingButton).not.toBeNull();

    await act(async () => user.click(showTimingButton!));

    expect(
      container.querySelector('button[aria-label="Hide metrics in trace tree"]')
    ).not.toBeNull();
  });
});
