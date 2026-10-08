import type { components } from "../__generated__/api/v1";

/**
 * An annotation configuration as returned by the Phoenix REST API.
 */
export type AnnotationConfig =
  | components["schemas"]["CategoricalAnnotationConfig"]
  | components["schemas"]["ContinuousAnnotationConfig"]
  | components["schemas"]["FreeformAnnotationConfig"];

/**
 * Identifies an annotation configuration. Accepts any of:
 * - `config` — an annotation config ID or name (the server accepts either)
 * - `configId` — an explicit annotation config ID
 * - `configName` — an explicit annotation config name
 *
 * Exactly one of these may be given. All three are sent to the server as the
 * same `config_identifier`, which is tried as a GlobalID before a name. Prefer
 * `configId` when a name may contain `/`, which the server cannot route in a
 * path parameter.
 */
export type AnnotationConfigIdentifier =
  | { config: string; configId?: never; configName?: never }
  | { configId: string; config?: never; configName?: never }
  | { configName: string; config?: never; configId?: never };

/**
 * Resolves an {@link AnnotationConfigIdentifier} union to a plain string
 * suitable for the REST `config_identifier` path parameter.
 */
export function resolveAnnotationConfigIdentifier(
  identifier: AnnotationConfigIdentifier
): string {
  if (identifier.config !== undefined) return identifier.config;
  if (identifier.configId !== undefined) return identifier.configId;
  return identifier.configName;
}
