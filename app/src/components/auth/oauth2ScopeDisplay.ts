import type { BadgeVariant } from "@phoenix/components/core/badge/types";

export interface OAuth2ScopeDisplay {
  /**
   * Short human-readable label shown in the scope badge
   */
  label: string;
  /**
   * One-sentence explanation of what the scope allows, suitable for tooltips
   */
  description: string;
  /**
   * Badge color variant conveying the scope's level of access
   */
  badgeVariant: BadgeVariant;
}

/**
 * Display metadata for the OAuth2 scopes Phoenix issues. Scopes not listed
 * here fall back to a neutral badge showing the raw scope string so new
 * server-side scopes degrade gracefully instead of being hidden.
 */
const KNOWN_SCOPE_DISPLAYS: Record<string, OAuth2ScopeDisplay> = {
  read_only: {
    label: "Read-only",
    description:
      "Can read traces, datasets, prompts, and experiments but cannot create, modify, or delete anything.",
    badgeVariant: "info",
  },
};

export function getOAuth2ScopeDisplay(scope: string): OAuth2ScopeDisplay {
  return (
    KNOWN_SCOPE_DISPLAYS[scope] ?? {
      label: scope,
      description: `Grants the "${scope}" scope.`,
      badgeVariant: "default",
    }
  );
}
