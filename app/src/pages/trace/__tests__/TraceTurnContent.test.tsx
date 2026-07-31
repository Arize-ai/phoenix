import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import {
  RootSpanMessage,
  TraceTurnNavigationSurface,
} from "../TraceTurnContent";

describe("RootSpanMessage", () => {
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

  it("opens output from anywhere in the output message", () => {
    const onMessageDoubleClick = vi.fn();
    act(() => {
      root.render(
        <ThemeProvider>
          <TraceTurnNavigationSurface
            onMessageDoubleClick={onMessageDoubleClick}
          >
            <RootSpanMessage
              role="OUTPUT"
              value="A long result"
              onDoubleClick={() => onMessageDoubleClick("OUTPUT")}
            />
          </TraceTurnNavigationSurface>
        </ThemeProvider>
      );
    });

    const message = container.querySelector<HTMLElement>(".root-span-message");
    expect(message?.title).toBe(
      "Double-click to view this output in the trace"
    );

    act(() => {
      message
        ?.querySelector(".text")
        ?.dispatchEvent(
          new MouseEvent("dblclick", { bubbles: true, cancelable: true })
        );
    });
    expect(onMessageDoubleClick).toHaveBeenCalledOnce();
    expect(onMessageDoubleClick).toHaveBeenCalledWith("OUTPUT");
  });

  it("defaults the background to input and leaves controls alone", () => {
    const onMessageDoubleClick = vi.fn();
    act(() => {
      root.render(
        <ThemeProvider>
          <TraceTurnNavigationSurface
            onMessageDoubleClick={onMessageDoubleClick}
          >
            <div className="turn-background">Background</div>
            <button type="button">Turn action</button>
          </TraceTurnNavigationSurface>
        </ThemeProvider>
      );
    });

    const background = container.querySelector(".turn-background");
    const nestedControl = container.querySelector("button");

    act(() => {
      background?.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
    });
    expect(onMessageDoubleClick).toHaveBeenLastCalledWith("INPUT");

    onMessageDoubleClick.mockClear();
    act(() => {
      nestedControl?.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
    });
    expect(onMessageDoubleClick).not.toHaveBeenCalled();
  });
});
