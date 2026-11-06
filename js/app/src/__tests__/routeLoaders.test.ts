import type { RouteObject } from "react-router";
import { describe, expect, it } from "vitest";

import { appRouteObjects } from "@phoenix/Routes";

/**
 * Routes whose loaders still await before returning, by path.
 *
 * React Router commits a navigation only once every matched loader has
 * returned, so a loader that awaits a fetch freezes the page the user is on
 * until the data lands, and the destination's skeleton is never seen. A
 * loader returns at once by handing the page `loadQuery` refs to suspend on,
 * and anything else, such as a breadcrumb's name, as a promise; the page owns
 * the `Suspense` boundary and the not-found state. See the route loader
 * rules in the `phoenix-frontend` skill's Relay reference.
 *
 * Remove a route from this list when its loader is converted. Do not add to
 * it. Redirect loaders are the one exception, since a redirect has no page to
 * show while it resolves.
 */
const ROUTES_WITH_BLOCKING_LOADERS = new Set<string>([
  "/",
  "/reset-password",
  "/projects/:projectId",
  "/projects/:projectId/evaluators/compare",
  "/datasets/:datasetId",
  "/datasets/:datasetId/evaluators/:evaluatorId",
  "/playground",
  "/playground/spans/:spanId",
  "/prompts/decisions/:decisionId",
  "/prompts/:promptId",
  "/prompts/:promptId/versions",
]);

const REDIRECT_LOADER_PATTERN = /RedirectLoader$/;

type RouteLoader = { name: string; path: string; loader: unknown };

function collectLoaders(routes: RouteObject[], parentPath = ""): RouteLoader[] {
  return routes.flatMap((route) => {
    const path = route.path
      ? `${parentPath}/${route.path}`.replace(/\/+/g, "/")
      : parentPath;
    const own: RouteLoader[] =
      typeof route.loader === "function"
        ? [
            {
              name: route.loader.name || "(anonymous)",
              path,
              loader: route.loader,
            },
          ]
        : [];
    return [...own, ...collectLoaders(route.children ?? [], path)];
  });
}

/** Loaders that await are written as `async` functions throughout the app. */
const isAsyncFunction = (fn: unknown) =>
  typeof fn === "function" && fn.constructor.name === "AsyncFunction";

describe("route loaders", () => {
  const loaders = collectLoaders(appRouteObjects);
  const blockingLoaders = loaders.filter(
    ({ name, loader }) =>
      isAsyncFunction(loader) && !REDIRECT_LOADER_PATTERN.test(name)
  );

  it("return without awaiting, so a navigation commits at once", () => {
    const unexpected = blockingLoaders
      .filter(({ path }) => !ROUTES_WITH_BLOCKING_LOADERS.has(path))
      .map(({ name, path }) => `${name} at ${path}`);
    expect(unexpected, "loaders that await outside the allowlist").toEqual([]);
  });

  it("lists only routes whose loaders still block", () => {
    const stale = [...ROUTES_WITH_BLOCKING_LOADERS].filter(
      (path) => !blockingLoaders.some((entry) => entry.path === path)
    );
    expect(stale, "allowlisted routes whose loaders no longer block").toEqual(
      []
    );
  });
});
