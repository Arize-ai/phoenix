export const PROFILE_ROOT_ROUTE = {
  path: "/profile",
  label: "Profile",
  description:
    "Open personal account settings, API keys, connected applications, and display preferences.",
} as const;

export const PROFILE_ROUTES = {
  account: {
    segment: "account",
    path: "/profile/account",
    tabLabel: "Account",
    label: "Profile Account",
    description:
      "View your email and role, update your username, and reset your local password.",
    paletteDescription: "Username, email, role, and password",
  },
  "api-keys": {
    segment: "api-keys",
    path: "/profile/api-keys",
    tabLabel: "API Keys",
    label: "Profile API Keys",
    description:
      "Create, view, and revoke personal API keys for programmatic access.",
    paletteDescription: "Personal keys for programmatic access",
  },
  apps: {
    segment: "apps",
    path: "/profile/apps",
    tabLabel: "Apps",
    label: "Profile Apps",
    description:
      "Review and revoke OAuth applications connected to your Phoenix account.",
    paletteDescription: "OAuth apps connected to your account",
  },
  preferences: {
    segment: "preferences",
    path: "/profile/preferences",
    tabLabel: "Preferences",
    label: "Profile Preferences",
    description:
      "Choose your theme, timezone, code language, and package manager defaults.",
    paletteDescription: "Theme, timezone, and code defaults",
  },
} as const;

export type ProfileRouteId = keyof typeof PROFILE_ROUTES;
