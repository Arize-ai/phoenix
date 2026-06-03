import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import {
  EDIT_ANNOTATION_CONFIG_DRAFT_TOOL_NAME,
  OPEN_ANNOTATION_CONFIG_FORM_TOOL_NAME,
  READ_ANNOTATION_CONFIG_DRAFT_TOOL_NAME,
} from "./constants";
import {
  parseEditAnnotationConfigDraftInput,
  parseOpenAnnotationConfigFormInput,
  parseReadAnnotationConfigDraftInput,
} from "./parsers";
import type {
  EditAnnotationConfigDraftInput,
  OpenAnnotationConfigFormInput,
  ReadAnnotationConfigDraftInput,
} from "./types";

/**
 * Opens the annotation-config form slideover mounted on the focused project
 * page. With an `annotationConfigId`, opens the existing config for editing;
 * otherwise opens a blank create form. Delegates to the client action the
 * slideover registers while open.
 */
export const openAnnotationConfigFormAgentTool =
  defineClientActionTool<OpenAnnotationConfigFormInput>({
    name: OPEN_ANNOTATION_CONFIG_FORM_TOOL_NAME,
    parseInput: parseOpenAnnotationConfigFormInput,
    invalidInputErrorText: `Invalid ${OPEN_ANNOTATION_CONFIG_FORM_TOOL_NAME} input. Expected { annotationConfigId?: string }.`,
    notMountedErrorText:
      "No project page is mounted; cannot open the annotation-config form.",
    defaultSuccessOutput: "Annotation-config form opened.",
  });

/** Reads the current annotation-config draft from the mounted form. */
export const readAnnotationConfigDraftAgentTool =
  defineClientActionTool<ReadAnnotationConfigDraftInput>({
    name: READ_ANNOTATION_CONFIG_DRAFT_TOOL_NAME,
    parseInput: parseReadAnnotationConfigDraftInput,
    invalidInputErrorText: `Invalid ${READ_ANNOTATION_CONFIG_DRAFT_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The annotation-config form is not mounted; cannot read the draft.",
    defaultSuccessOutput: "Annotation-config draft read.",
  });

/** Applies edit operations to the mounted annotation-config draft. */
export const editAnnotationConfigDraftAgentTool =
  defineClientActionTool<EditAnnotationConfigDraftInput>({
    name: EDIT_ANNOTATION_CONFIG_DRAFT_TOOL_NAME,
    parseInput: parseEditAnnotationConfigDraftInput,
    invalidInputErrorText: `Invalid ${EDIT_ANNOTATION_CONFIG_DRAFT_TOOL_NAME} input. Expected { operations: EditAnnotationConfigDraftOperation[] }.`,
    notMountedErrorText:
      "The annotation-config form is not mounted; cannot edit the draft.",
    defaultSuccessOutput: "Annotation-config draft updated.",
  });
