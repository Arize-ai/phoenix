import { useCallback, useRef } from "react";
import type { NavigateOptions, SetURLSearchParams } from "react-router";
import {
  createSearchParams,
  useLocation,
  useNavigate,
  useSearchParams as useRouterSearchParams,
} from "react-router";

/**
 * `useSearchParams`, but writes keep the URL fragment.
 *
 * React Router's setter rebuilds the location from pathname and search alone,
 * so it silently erases whatever is in the hash: changing the time range would
 * drop the span filter. Phoenix keeps that filter in the fragment because it is
 * free-form user text and query strings reach every proxy log in front of the
 * server, so every writer has to preserve it. A lint rule keeps the raw hook
 * from being imported directly.
 *
 * Two limits, both inherited from the hook this replaces:
 *
 * - Writers do not compose within a tick. Each setter rebuilds the location
 *   from the snapshot it rendered with, so of two callers writing in one tick
 *   the second wins. React Router loses params the same way; here the fragment
 *   is subject to it too. Coordinating would need a shared record of the
 *   pending location, which React Router does not expose.
 * - The setter is stable only under a data router, since it depends on
 *   `navigate`. `createBrowserRouter` keeps that identity fixed, `MemoryRouter`
 *   changes it whenever the pathname does. The app uses the former; tests and
 *   stories on `MemoryRouter` should not rely on the identity holding.
 *
 * `defaultInit` is deliberately unsupported: it stops merging only once React
 * Router's own setter marks the params as set, and this one navigates directly,
 * so defaults would reapply after every write and never clear.
 */
export function useSearchParams(): [URLSearchParams, SetURLSearchParams] {
  const [searchParams] = useRouterSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Read at call time rather than depended on, so the setter keeps its identity
  // across writes -- callers hand it to effects that key on that identity.
  // Assigned during render because a child's layout effect runs before this
  // component's passive effect and would otherwise write to a stale location.
  // The assignment is idempotent, so a double render is harmless.
  const latest = useRef({ searchParams, location });
  latest.current = { searchParams, location };

  const setSearchParams = useCallback<SetURLSearchParams>(
    (nextInit, navigateOptions?: NavigateOptions) => {
      const { searchParams: current, location: at } = latest.current;
      // A copy, as React Router's updater gets: callers are encouraged to
      // mutate the argument and several here do, and the live object would let
      // those edits reach other readers before the navigation publishes them.
      // `createSearchParams` also accepts the record-of-arrays form that the
      // `URLSearchParams` constructor does not.
      const next =
        typeof nextInit === "function"
          ? createSearchParams(nextInit(new URLSearchParams(current)))
          : createSearchParams(nextInit);
      const search = next.toString();
      navigate(
        {
          pathname: at.pathname,
          search: search ? `?${search}` : "",
          hash: at.hash,
        },
        navigateOptions
      );
    },
    [navigate]
  );

  return [searchParams, setSearchParams];
}
