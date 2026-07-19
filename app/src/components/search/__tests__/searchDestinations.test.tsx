import {
  getMatchingSearchDestinationSections,
  PROFILE_DESTINATIONS,
} from "../searchDestinations";

const contains = (value: string, substring: string) =>
  value.toLocaleLowerCase().includes(substring.toLocaleLowerCase());

describe("search destinations", () => {
  it("shows profile routes together when searching for profile", () => {
    const sections = getMatchingSearchDestinationSections({
      inputValue: "profile",
      contains,
      hasViewer: true,
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("Profile");
    expect(
      sections[0]?.destinations.map((destination) => destination.label)
    ).toEqual(["Account", "API Keys", "Apps", "Preferences"]);
  });

  it("searches destination descriptions", () => {
    const sections = getMatchingSearchDestinationSections({
      inputValue: "OAuth",
      contains,
      hasViewer: true,
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
      hasViewer: false,
    });

    expect(sections).toHaveLength(1);
    expect(
      sections[0]?.destinations.map((destination) => destination.label)
    ).toEqual(["Preferences"]);
  });

  it("provides a direct destination and icon for every profile section", () => {
    expect(
      PROFILE_DESTINATIONS.map(
        ({ path, label, description, icon, requiresViewer }) => ({
          path,
          label,
          description,
          hasIcon: icon != null,
          requiresViewer: requiresViewer ?? false,
        })
      )
    ).toEqual([
      {
        path: "/profile/account",
        label: "Account",
        description: "Username, email, role, and password",
        hasIcon: true,
        requiresViewer: true,
      },
      {
        path: "/profile/api-keys",
        label: "API Keys",
        description: "Personal keys for programmatic access",
        hasIcon: true,
        requiresViewer: true,
      },
      {
        path: "/profile/apps",
        label: "Apps",
        description: "OAuth apps connected to your account",
        hasIcon: true,
        requiresViewer: true,
      },
      {
        path: "/profile/preferences",
        label: "Preferences",
        description: "Theme, timezone, and code defaults",
        hasIcon: true,
        requiresViewer: false,
      },
    ]);
  });
});
