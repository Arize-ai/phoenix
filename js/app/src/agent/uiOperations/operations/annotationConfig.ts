import {
  createAnnotationConfigInputSchema,
  updateAnnotationConfigInputSchema,
} from "@phoenix/agent/tools/annotationConfig/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/**
 * Catalog entries replacing the standalone annotation-config write tools
 * (`create_annotation_config`, `update_annotation_config`). Approval
 * operations staged in the shared annotation-config approval card,
 * registered at the app root. Input schemas are reused from the existing
 * tool module; descriptions are ported from the Python `DESCRIPTION`s with
 * tool names rewritten to operation names.
 */

const APPROVAL_UI_BEHAVIOR = {
  autoOpen: true,
  scrollIntoViewOnMount: true,
} as const;

export const createAnnotationConfigOperation = defineUiOperation({
  name: "annotationConfig.create",
  description:
    "Create a new annotation config — the project's codified rubric for one dimension (a " +
    "stable name, a type, and its allowed outcomes) — and, when a projectId is given, " +
    "associate it with that project in the same approved action. Use this to codify a new " +
    "annotation category before annotating against it. To change an existing config, use " +
    "annotationConfig.update instead.",
  inputSchema: createAnnotationConfigInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const updateAnnotationConfigOperation = defineUiOperation({
  name: "annotationConfig.update",
  description:
    "Update an existing annotation config. This is a full replace: pass the complete config " +
    "as it should be afterward (keep the same name and include every value you want to keep, " +
    "plus any new ones), not just the changed fields — any existing label not included is " +
    "removed. Use this to add a label to a config that is close but missing one. To create a " +
    "brand-new config, use annotationConfig.create instead.",
  inputSchema: updateAnnotationConfigInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

/** All annotation-config operations, for catalog assembly and registration. */
export const annotationConfigOperations: UiOperationDescriptor[] = [
  createAnnotationConfigOperation,
  updateAnnotationConfigOperation,
];
