import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import { toAnnotationConfigDraft } from "./buildAnnotationConfigInput";
import {
  CREATE_ANNOTATION_CONFIG_TOOL_NAME,
  UPDATE_ANNOTATION_CONFIG_TOOL_NAME,
} from "./constants";
import { commitCreateAnnotationConfig } from "./createAnnotationConfig";
import {
  parseCreateAnnotationConfigInput,
  parseUpdateAnnotationConfigInput,
} from "./parsers";
import { stageAnnotationConfigWrite } from "./pendingAnnotationConfigWrite";
import type {
  CreateAnnotationConfigInput,
  UpdateAnnotationConfigInput,
} from "./types";
import { commitUpdateAnnotationConfig } from "./updateAnnotationConfig";

/**
 * Proposes creating a new annotation config (optionally associating it with a
 * project) as a pending change. Auto-applies when edit approvals are bypassed;
 * otherwise stores the proposal for the UI to accept or reject.
 */
export const createAnnotationConfigAgentTool =
  defineTool<CreateAnnotationConfigInput>({
    name: CREATE_ANNOTATION_CONFIG_TOOL_NAME,
    parseInput: parseCreateAnnotationConfigInput,
    invalidInputErrorText: `Invalid ${CREATE_ANNOTATION_CONFIG_TOOL_NAME} input. Expected { type: "categorical" | "continuous" | "freeform", name: string, description?: string | null, optimizationDirection?: "MINIMIZE" | "MAXIMIZE" | "NONE", values?: [{ label: string, score?: number | null }], lowerBound?: number | null, upperBound?: number | null, threshold?: number | null, projectId?: string | null }. Categorical configs require a non-empty values array.`,
    uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const draft = toAnnotationConfigDraft(input);
      await stageAnnotationConfigWrite({
        pending: {
          toolCallId: toolCall.toolCallId,
          toolName: CREATE_ANNOTATION_CONFIG_TOOL_NAME,
          preview: {
            kind: "create",
            draft,
            projectId: input.projectId ?? null,
          },
        },
        apply: () =>
          commitCreateAnnotationConfig(draft, input.projectId ?? null),
        addToolOutput,
        agentStore,
      });
    },
  });

/**
 * Proposes a full replace of an existing annotation config as a pending change.
 * Auto-applies when edit approvals are bypassed; otherwise stores the proposal
 * for the UI to accept or reject.
 */
export const updateAnnotationConfigAgentTool =
  defineTool<UpdateAnnotationConfigInput>({
    name: UPDATE_ANNOTATION_CONFIG_TOOL_NAME,
    parseInput: parseUpdateAnnotationConfigInput,
    invalidInputErrorText: `Invalid ${UPDATE_ANNOTATION_CONFIG_TOOL_NAME} input. Expected { id: string, type: "categorical" | "continuous" | "freeform", name: string, description?: string | null, optimizationDirection?: "MINIMIZE" | "MAXIMIZE" | "NONE", values?: [{ label: string, score?: number | null }], lowerBound?: number | null, upperBound?: number | null, threshold?: number | null }. This is a full replace — pass the complete config.`,
    uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const draft = toAnnotationConfigDraft(input);
      await stageAnnotationConfigWrite({
        pending: {
          toolCallId: toolCall.toolCallId,
          toolName: UPDATE_ANNOTATION_CONFIG_TOOL_NAME,
          preview: { kind: "update", configId: input.id, draft },
        },
        apply: () => commitUpdateAnnotationConfig(input.id, draft),
        addToolOutput,
        agentStore,
      });
    },
  });
