export const DEFAULT_PROMPT_VERSION_TAGS = [
  {
    name: "production",
    description: "The version deployed to production",
  },
  {
    name: "staging",
    description: "The version deployed to staging",
  },
  {
    name: "development",
    description: "The version deployed for development",
  },
];

/**
 * Resolve the color for a prompt version tag.
 *
 * The default lifecycle tags (production / staging / development) get their
 * semantic hues; everything else falls back to a neutral gray. This is the
 * single source of truth for tag coloring so prompt pages and any other
 * surface that renders version tags stay visually consistent.
 */
export function getPromptVersionTagColor(tagName: string): string {
  switch (tagName) {
    case "production":
      return "var(--global-color-green-1000)";
    case "staging":
      return "var(--global-color-yellow-1000)";
    case "development":
      return "var(--global-color-blue-1000)";
    default:
      return "var(--global-color-gray-900)";
  }
}
