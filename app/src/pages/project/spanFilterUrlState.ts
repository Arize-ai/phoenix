import { useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

import { SPAN_FILTER_CONDITION_KEY } from "@phoenix/utils/scopedFragmentState";

/**
 * The span filter lives in the URL fragment rather than the query string.
 *
 * A condition is free-form user text that routinely contains the very data
 * being searched for -- an address, an account id, a phrase from a prompt.
 * Query strings are transmitted, so every hop in front of Phoenix sees them and
 * most log them by default: a reverse proxy's request line, a load balancer, a
 * gateway, a mesh sidecar. Redacting Phoenix's own log does nothing about any
 * of those. Fragments are never sent, so the condition reaches no server and
 * therefore no log, while still surviving reload, back/forward, and a shared
 * link. It does remain in the address bar and in history, which is the point.
 *
 * The key itself is defined in `scopedFragmentState`, which pairs it with the
 * route scope that consumes it so cross-boundary links (the breadcrumbs) can
 * drop it when a navigation leaves that scope.
 */
export { SPAN_FILTER_CONDITION_KEY };

/**
 * The condition carried by a location hash, or null when it carries none.
 *
 * Null and the empty string mean different things and both are preserved: an
 * absent key seeds the view's default, while a present-but-empty one means the
 * filter was deliberately cleared.
 */
export function readSpanFilterFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, "")).get(
    SPAN_FILTER_CONDITION_KEY
  );
}

/** The hash that carries this condition, leaving any other entries alone. */
export function writeSpanFilterToHash(hash: string, condition: string): string {
  const entries = new URLSearchParams(hash.replace(/^#/, ""));
  entries.set(SPAN_FILTER_CONDITION_KEY, condition);
  return `#${entries.toString()}`;
}

/** The condition in the current URL, tracked across navigation. */
export function useSpanFilterFromHash(): string | null {
  const { hash } = useLocation();
  return readSpanFilterFromHash(hash);
}

/**
 * A stable writer for the condition in the URL.
 *
 * Stable because the field's callbacks reach components that would otherwise
 * revalidate whenever the location changed. The location is therefore read at
 * call time, and assigned during render rather than in an effect -- see
 * `useSearchParams`, which reads it the same way and for the same reasons.
 */
export function useWriteSpanFilterToHash(): (condition: string) => void {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  return useCallback(
    (condition: string) => {
      const { pathname, search, hash } = locationRef.current;
      const nextHash = writeSpanFilterToHash(hash, condition);
      if (nextHash === hash) {
        return;
      }
      navigate({ pathname, search, hash: nextHash }, { replace: true });
    },
    [navigate]
  );
}
