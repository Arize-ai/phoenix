import { navigationGoToInputSchema } from "@phoenix/agent/tools/navigation/schemas";

import type { UIOperationDescriptor } from "../types";
import { defineUIOperation } from "../types";

/**
 * Approval-gated navigation, per the RFC in `PLAN.md`. The handler registers
 * at the app root, so the operation is available from every page — exactly
 * right, since its job is to be reachable when the operation the script
 * wants is not. Unlike every other approval operation it is NEVER
 * auto-accepted, even in bypass edit mode: an edit changes something the
 * user is looking at, a navigation moves their view.
 */
export const navigationGoToOperation = defineUIOperation({
  name: "navigation.goTo",
  description:
    "Ask the user to navigate to another Phoenix page. Stages an approval card that names the " +
    "destination and your reason; on accept the app navigates and the promise resolves after " +
    "the route change commits, so the destination page's operations can register. `path` must " +
    "match a route from get_route_info — a path outside the route catalog is rejected. Use " +
    "this when an operation you need is not available on the current page. This operation is " +
    "never auto-approved; if the user declines, do not retry — offer a markdown link to the " +
    "destination instead.",
  inputSchema: navigationGoToInputSchema,
  kind: "approval",
  requireSession: true,
  UIBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
});

/** All navigation operations, for catalog assembly and root registration. */
export const navigationOperations: UIOperationDescriptor[] = [
  navigationGoToOperation,
];
