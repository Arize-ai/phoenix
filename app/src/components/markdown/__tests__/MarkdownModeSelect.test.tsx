import { act, startTransition, useState } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { MarkdownDisplayContext } from "../MarkdownDisplayContext";
import { ConnectedMarkdownModeSelect } from "../MarkdownModeSelect";
import type { MarkdownDisplayMode } from "../types";

describe("ConnectedMarkdownModeSelect", () => {
  let container: HTMLDivElement;
  let root: Root;
  let animationFrameCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    animationFrameCallbacks = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  function flushAnimationFrames() {
    const callbacks = animationFrameCallbacks.splice(0);
    act(() => {
      callbacks.forEach((callback) => callback(performance.now()));
    });
  }

  it("keeps its owning card at the same scroll-container offset after reflow", async () => {
    let modeControlTop = 200;

    function Harness() {
      const [mode, setMode] = useState<MarkdownDisplayMode>("text");
      const handleModeChange = (newMode: MarkdownDisplayMode) => {
        startTransition(() => {
          modeControlTop = 260;
          setMode(newMode);
        });
      };
      return (
        <MarkdownDisplayContext.Provider
          value={{ mode, setMode: handleModeChange }}
        >
          <div data-scroll-container style={{ overflowY: "auto" }}>
            <section className="card">
              <ConnectedMarkdownModeSelect />
            </section>
          </div>
        </MarkdownDisplayContext.Provider>
      );
    }

    act(() => root.render(<Harness />));
    flushAnimationFrames();

    const scrollContainer = container.querySelector<HTMLElement>(
      "[data-scroll-container]"
    );
    const modeControl =
      container.querySelector<HTMLElement>(".segmented-control");
    const markdownButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".segmented-control__item")
    ).find((button) => button.textContent === "Markdown");
    expect(scrollContainer).not.toBeNull();
    expect(modeControl).not.toBeNull();
    expect(markdownButton).toBeDefined();

    scrollContainer!.scrollTop = 100;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this === scrollContainer) {
          return DOMRect.fromRect({ y: 50 });
        }
        if (this === modeControl) {
          return DOMRect.fromRect({ y: modeControlTop });
        }
        return DOMRect.fromRect();
      }
    );

    await act(async () => markdownButton?.click());

    expect(scrollContainer!.scrollTop).toBe(160);
  });
});
