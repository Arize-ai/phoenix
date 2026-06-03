import type { z } from "zod";

import type { AnnotationConfigDraftValues } from "@phoenix/store/annotationConfigDraftStore";

import type {
  editAnnotationConfigDraftInputSchema,
  editAnnotationConfigDraftOperationSchema,
  openAnnotationConfigFormInputSchema,
  readAnnotationConfigDraftInputSchema,
} from "./schemas";

export type ReadAnnotationConfigDraftInput = z.output<
  typeof readAnnotationConfigDraftInputSchema
>;

export type OpenAnnotationConfigFormInput = z.output<
  typeof openAnnotationConfigFormInputSchema
>;

export type EditAnnotationConfigDraftOperation = z.output<
  typeof editAnnotationConfigDraftOperationSchema
>;

export type EditAnnotationConfigDraftInput = z.output<
  typeof editAnnotationConfigDraftInputSchema
>;

/**
 * The agent-facing view of the open form: the flat draft values plus the form
 * mode and (in edit mode) the relay node id of the config being edited.
 */
export type AnnotationConfigDraftSnapshot = {
  mode: "create" | "edit";
  annotationConfigNodeId: string | null;
} & AnnotationConfigDraftValues;

export type AnnotationConfigActionResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; error: string };

export type AnnotationConfigDraftHost = {
  getSnapshot: () => AnnotationConfigDraftSnapshot;
  applyOperations: (
    operations: EditAnnotationConfigDraftOperation[]
  ) => AnnotationConfigActionResult<AnnotationConfigDraftSnapshot>;
  previewOperations: (
    snapshot: AnnotationConfigDraftSnapshot,
    operations: EditAnnotationConfigDraftOperation[]
  ) => AnnotationConfigActionResult<AnnotationConfigDraftSnapshot>;
};
