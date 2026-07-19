import { appRouteObjects } from "@phoenix/Routes";
import { buildRouteNavigationCatalog } from "@phoenix/routing/routeNavigation";

import {
  getMatchingSearchDestinationSections,
  getSearchDestinationSections,
} from "../searchDestinations";

const contains = (value: string, substring: string) =>
  value.toLocaleLowerCase().includes(substring.toLocaleLowerCase());
const startsWith = (value: string, substring: string) =>
  value.toLocaleLowerCase().startsWith(substring.toLocaleLowerCase());
const routeSections = getSearchDestinationSections(
  buildRouteNavigationCatalog(appRouteObjects)
);

describe("search destinations", () => {
  it("shows profile routes together when searching for profile", () => {
    const sections = getMatchingSearchDestinationSections({
      inputValue: "profile",
      contains,
      startsWith,
      hasViewer: true,
      sections: routeSections,
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("Profile");
    expect(
      sections[0]?.destinations.map((destination) => destination.metadata.label)
    ).toEqual(["Account", "API Keys", "Apps", "Preferences"]);
  });

  it("does not match sections on non-prefix substrings of their title", () => {
    const sections = getMatchingSearchDestinationSections({
      inputValue: "file",
      contains,
      startsWith,
      hasViewer: true,
      sections: routeSections,
    });

    expect(
      sections.find((section) => section.title === "Profile")
    ).toBeUndefined();
  });

  it("searches destination descriptions", () => {
    const sections = getMatchingSearchDestinationSections({
      inputValue: "OAuth",
      contains,
      startsWith,
      hasViewer: true,
      sections: routeSections,
    });

    expect(sections).toHaveLength(1);
    expect(
      sections[0]?.destinations.map((destination) => destination.path)
    ).toEqual(["/profile/apps"]);
  });

  it("hides viewer-only profile routes when authentication is disabled", () => {
    const sections = getMatchingSearchDestinationSections({
      inputValue: "profile",
      contains,
      startsWith,
      hasViewer: false,
      sections: routeSections,
    });

    expect(sections).toHaveLength(1);
    expect(
      sections[0]?.destinations.map((destination) => destination.metadata.label)
    ).toEqual(["Preferences"]);
  });

  it("provides a direct destination and icon for every profile section", () => {
    const profileDestinations = routeSections.find(
      (section) => section.title === "Profile"
    )?.destinations;

    expect(
      profileDestinations?.map(({ path, metadata }) => ({
        path,
        label: metadata.label,
        description: metadata.description,
        icon: metadata.icon,
        requiresViewer: metadata.requiresViewer ?? false,
      }))
    ).toEqual([
      {
        path: "/profile/account",
        label: "Account",
        description: "Username, email, role, and password",
        icon: "Person",
        requiresViewer: true,
      },
      {
        path: "/profile/api-keys",
        label: "API Keys",
        description: "Personal keys for programmatic access",
        icon: "Key",
        requiresViewer: true,
      },
      {
        path: "/profile/apps",
        label: "Apps",
        description: "OAuth apps connected to your account",
        icon: "Link2",
        requiresViewer: true,
      },
      {
        path: "/profile/preferences",
        label: "Preferences",
        description: "Theme, timezone, and code defaults",
        icon: "Options",
        requiresViewer: false,
      },
    ]);
  });

  it("derives page destinations from React Router handles", () => {
    expect(
      routeSections
        .find((section) => section.title === "Pages")
        ?.destinations.map(({ path, metadata }) => [path, metadata.label])
    ).toEqual([
      ["/projects", "Tracing"],
      ["/dashboards", "Dashboards"],
      ["/datasets", "Datasets & Experiments"],
      ["/playground", "Playground"],
      ["/evaluators", "Evaluators"],
      ["/prompts", "Prompts"],
      ["/apis/rest", "REST API"],
      ["/apis/graphql", "GraphQL"],
      ["/settings/general", "Settings"],
    ]);
  });
});
