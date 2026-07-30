import { useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

import { SPAN_FILTER_CONDITION_KEY } from "@phoenix/utils/scopedFragmentState";

/**
 * Filter conditions live in the URL fragment rather than the query string.
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
 * Every function here takes the fragment key to act on, because each
 * filter-consuming view owns its own key -- the spans tab, the traces tab, and
 * the dataset evaluator spans view each read only their own. The keys and the
 * route scopes that consume them are defined in `scopedFragmentState`, which
 * also lets cross-boundary links (the breadcrumbs) drop a key when a
 * navigation leaves its scope.
 */
export { SPAN_FILTER_CONDITION_KEY };

/**
 * The condition carried under `key` by a location hash, or null when it
 * carries none.
 *
 * Null and the empty string mean different things and both are preserved: an
 * absent key seeds the view's default, while a present-but-empty one means the
 * filter was deliberately cleared.
 */
export function readFilterConditionFromHash(
  hash: string,
  key: string
): string | null {
  return new URLSearchParams(hash.replace(/^#/, "")).get(key);
}

/** The hash that carries this condition, leaving any other entries alone. */
export function writeFilterConditionToHash(
  hash: string,
  key: string,
  condition: string
): string {
  const entries = new URLSearchParams(hash.replace(/^#/, ""));
  entries.set(key, condition);
  return `#${entries.toString()}`;
}

/** The condition under `key` in the current URL, tracked across navigation. */
export function useFilterConditionFromHash(key: string): string | null {
  const { hash } = useLocation();
  return readFilterConditionFromHash(hash, key);
}

/**
 * A stable writer for the condition under `key` in the URL.
 *
 * Stable because the field's callbacks reach components that would otherwise
 * revalidate whenever the location changed. The location is therefore read at
 * call time, and assigned during render rather than in an effect -- see
 * `useSearchParams`, which reads it the same way and for the same reasons.
 */
export function useWriteFilterConditionToHash(
  key: string
): (condition: string) => void {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  return useCallback(
    (condition: string) => {
      const { pathname, search, hash } = locationRef.current;
      const nextHash = writeFilterConditionToHash(hash, key, condition);
      if (nextHash === hash) {
        return;
      }
      navigate({ pathname, search, hash: nextHash }, { replace: true });
    },
    [navigate, key]
  );
}
