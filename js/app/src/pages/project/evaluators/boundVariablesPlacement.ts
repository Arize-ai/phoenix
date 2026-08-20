/**
 * Where the list of values a record supplies by name is shown.
 *
 * Both homes render the same list from the same values; which one reads better
 * next to the rest of the authoring surface is still being decided, so the
 * choice is one constant rather than a branch at each site.
 */
export type BoundVariablesPlacement = "mapping-section" | "scope-panel";

export const BOUND_VARIABLES_PLACEMENT: BoundVariablesPlacement = "scope-panel";
