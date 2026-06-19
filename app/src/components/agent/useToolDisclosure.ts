import { useCallback, useRef, useState } from "react";

import { useScrollAnchor } from "./scrollAnchor";

/**
 * Open/closed controller for a tool-call disclosure (a single {@link ToolPart}
 * `<details>` card).
 *
 * The rendered open state is a manual override layered on a default: until the
 * user toggles, the disclosure follows `defaultOpen` (which callers derive from
 * their auto-open heuristic), and once toggled the user's choice wins even if
 * the default later flips (e.g. a tool keeps requesting auto-open while it
 * streams). Every toggle is bracketed with scroll anchoring so growing or
 * shrinking the disclosure doesn't jump the transcript.
 *
 * The ref is generic so callers can attach it to whichever element they anchor
 * on and reuse it for other measurements.
 */
export function useToolDisclosure<T extends HTMLElement = HTMLElement>({
  defaultOpen,
}: {
  defaultOpen: boolean;
}) {
  const ref = useRef<T>(null);
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const scrollAnchor = useScrollAnchor();

  const isOpen = manualOpen ?? defaultOpen;

  // `toggle` closes over `defaultOpen`, so it is recreated whenever the
  // streaming default flips. That is harmless: once `manualOpen` is set, the
  // `previousManualOpen ?? defaultOpen` read ignores `defaultOpen` entirely —
  // the dependency only matters for the very first toggle off the default.
  const toggle = useCallback(() => {
    // Record the disclosure's position before it grows/shrinks, flip the open
    // state, then restore the same spot once the DOM has updated.
    scrollAnchor.capture(ref.current);
    setManualOpen((previousManualOpen) => !(previousManualOpen ?? defaultOpen));
    requestAnimationFrame(() => scrollAnchor.restore(ref.current));
  }, [scrollAnchor, defaultOpen]);

  return { ref, isOpen, toggle };
}
