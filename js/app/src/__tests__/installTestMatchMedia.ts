import { afterEach, beforeEach, vi } from "vitest";

// Opt-in `window.matchMedia` stub — jsdom does not implement matchMedia, so
// any test that mounts a component using media queries (e.g. useMediaQuery)
// must import this and call `installTestMatchMedia()` once at the top of the
// test file (or inside a `describe` block).
export function installTestMatchMedia({
  matches = false,
}: { matches?: boolean } = {}): void {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });
}
