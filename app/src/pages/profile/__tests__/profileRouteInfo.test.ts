import { buildRouteInfoCatalog } from "@phoenix/agent/tools/getRouteInfo/catalog";
import { getRouteInfoFromCatalog } from "@phoenix/agent/tools/getRouteInfo/getRouteInfo";
import { appRouteObjects } from "@phoenix/Routes";

describe("profile route information", () => {
  const catalog = buildRouteInfoCatalog(appRouteObjects);

  it("registers clean metadata for the profile root and every section", () => {
    expect(
      catalog
        .filter((entry) => entry.path.startsWith("/profile"))
        .map((entry) => ({
          path: entry.path,
          label: entry.metadata.label,
          description: entry.metadata.description,
        }))
    ).toEqual([
      {
        path: "/profile",
        label: "Profile",
        description:
          "Open personal account settings, API keys, connected applications, and display preferences.",
      },
      {
        path: "/profile/account",
        label: "Profile Account",
        description:
          "View your email and role, update your username, and reset your local password.",
      },
      {
        path: "/profile/api-keys",
        label: "Profile API Keys",
        description:
          "Create, view, and revoke personal API keys for programmatic access.",
      },
      {
        path: "/profile/apps",
        label: "Profile Apps",
        description:
          "Review and revoke OAuth applications connected to your Phoenix account.",
      },
      {
        path: "/profile/preferences",
        label: "Profile Preferences",
        description:
          "Choose your theme, timezone, code language, and package manager defaults.",
      },
    ]);
  });

  it.each([
    ["change my username", "/profile/account"],
    ["personal API key", "/profile/api-keys"],
    ["revoke connected OAuth app", "/profile/apps"],
    ["change my timezone", "/profile/preferences"],
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
