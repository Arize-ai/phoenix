import { buildRouteInfoCatalog } from "@phoenix/agent/tools/getRouteInfo/catalog";
import { getRouteInfoFromCatalog } from "@phoenix/agent/tools/getRouteInfo/getRouteInfo";
import { appRouteObjects } from "@phoenix/Routes";

import { PROFILE_ROOT_ROUTE, PROFILE_ROUTES } from "../profileRoutes";

describe("profile route information", () => {
  const catalog = buildRouteInfoCatalog(appRouteObjects);

  it("registers clean metadata for the profile root and every section", () => {
    const expectedRoutes = [
      PROFILE_ROOT_ROUTE,
      ...Object.values(PROFILE_ROUTES),
    ];

    expect(
      catalog
        .filter((entry) => entry.path.startsWith(PROFILE_ROOT_ROUTE.path))
        .map((entry) => ({
          path: entry.path,
          label: entry.metadata.label,
          description: entry.metadata.description,
        }))
    ).toEqual(
      expectedRoutes.map(({ path, label, description }) => ({
        path,
        label,
        description,
      }))
    );
  });

  it.each([
    ["change my username", PROFILE_ROUTES.account.path],
    ["personal API key", PROFILE_ROUTES["api-keys"].path],
    ["revoke connected OAuth app", PROFILE_ROUTES.apps.path],
    ["change my timezone", PROFILE_ROUTES.preferences.path],
  ])("finds %s at %s", (query, expectedPath) => {
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query, limit: 5 },
      contexts: [],
    });

    expect(result.matches[0]?.path).toBe(expectedPath);
    expect(result.matches[0]?.link).toBe(expectedPath);
  });
});
