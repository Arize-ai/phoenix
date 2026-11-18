import type { TagColor } from "@phoenix/components/core/tag";

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
 * semantic hues; everything else is neutral. This is the
 * single source of truth for tag coloring so prompt pages and any other
 * surface that renders version tags stay visually consistent.
 */
export function getPromptVersionTagColor(tagName: string): TagColor {
  switch (tagName) {
    case "production":
      return "green";
    case "staging":
      return "yellow";
    case "development":
      return "blue";
    default:
      return "neutral";
  }
}
