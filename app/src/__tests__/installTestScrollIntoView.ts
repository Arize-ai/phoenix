import { afterEach, beforeEach, vi } from "vitest";

// Opt-in `Element.prototype.scrollIntoView` stub. jsdom has no layout and does
// not implement it, so any test that exercises a component which scrolls an
// element into view must import this and call `installTestScrollIntoView()`
// once at the top of the test file (or inside a `describe` block).
//
// Returns the mock, so a test can assert that something was scrolled to.
export function installTestScrollIntoView(): { calls: Element[] } {
  const original = Element.prototype.scrollIntoView;
  const scrolledTo: Element[] = [];

  beforeEach(() => {
    scrolledTo.length = 0;
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolledTo.push(this);
    });
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = original;
  });

  return {
    get calls() {
      return scrolledTo;
    },
  };
}
