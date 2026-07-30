/**
 * View state carried in the URL fragment, and the route scopes that consume it.
 *
 * Filter conditions live in the fragment rather than the query string: a
 * condition is free-form user text that routinely contains the very data being
 * searched for, query strings are transmitted and logged by every hop in front
 * of Phoenix, and fragments are never sent -- see `spanFilterUrlState`. The
 * fragment therefore survives reload, back/forward, and shared links, which is
 * the point.
 *
 * Surviving *navigation* is scoped, though. A filter is meaningful only to the
 * views that consume its key -- a span filter belongs to one project's spans
 * and traces tables, or to one dataset evaluator's spans view. Fragment-
 * preserving links that leave that scope would carry the filter onto pages
 * that cannot use it, where it lingers in the address bar until a later
 * navigation deposits it on a view that can -- a different project, a
 * different evaluator -- as a starting filter the user never applied there.
 *
 * Each key below declares the scope that consumes it. Cross-boundary link
 * builders (the breadcrumbs) call `retainScopedFragmentState` to keep a key
 * only while the navigation stays inside one scope instance, and to drop it
 * -- including any stale leftovers -- when the link leads elsewhere. Future
 * fragment keys (e.g. a trace or session filter condition) register here and
 * inherit the boundary behavior without new stripping logic.
 */

/**
 * The fragment key carrying the span filter condition. Shared by a project's
 * spans and traces tabs (deliberately -- an applied filter follows the user
 * across them) and by the dataset evaluator spans view for its own URLs.
 */
export const SPAN_FILTER_CONDITION_KEY = "spanFilterCondition";

type ScopedFragmentKey = {
  key: string;
  /**
   * The scope instance that owns this key at `pathname`, or null when the
   * pathname lies outside every scope that consumes the key. Two pathnames
   * share the key's state exactly when this returns the same non-null value
   * for both.
   */
  scopeOf: (pathname: string) => string | null;
};

/**
 * Router-relative pathnames, so a configured basename never appears here:
 * `useLocation().pathname` and `useMatches()[n].pathname` both exclude it.
 */
function spanFilterScope(pathname: string): string | null {
  const project = /^\/projects\/([^/]+)/.exec(pathname);
  if (project) {
    return `projects/${project[1]}`;
  }
  const evaluator = /^\/datasets\/([^/]+)\/evaluators\/([^/]+)/.exec(pathname);
  if (evaluator) {
    return `datasets/${evaluator[1]}/evaluators/${evaluator[2]}`;
  }
  return null;
}

const SCOPED_FRAGMENT_KEYS: ScopedFragmentKey[] = [
  { key: SPAN_FILTER_CONDITION_KEY, scopeOf: spanFilterScope },
];

/**
 * The hash a cross-boundary link should carry: `hash` with each registered key
 * kept only when the navigation stays inside one instance of that key's scope,
 * and removed otherwise. Entries no key claims pass through untouched, and a
 * hash left with no entries collapses to the empty string.
 *
 * Removal applies whether or not the source is in scope, so a crumb clicked on
 * an unrelated page also cleans up a leftover key instead of ferrying it on.
 */
export function retainScopedFragmentState({
  hash,
  fromPathname,
  toPathname,
}: {
  hash: string;
  fromPathname: string;
  toPathname: string;
}): string {
  if (!hash || hash === "#") {
    return "";
  }
  const entries = new URLSearchParams(hash.replace(/^#/, ""));
  for (const { key, scopeOf } of SCOPED_FRAGMENT_KEYS) {
    if (!entries.has(key)) {
      continue;
    }
    const fromScope = scopeOf(fromPathname);
    if (fromScope === null || fromScope !== scopeOf(toPathname)) {
      entries.delete(key);
    }
  }
  const retained = entries.toString();
  return retained ? `#${retained}` : "";
}
