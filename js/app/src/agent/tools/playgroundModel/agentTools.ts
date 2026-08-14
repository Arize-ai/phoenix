import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import {
  LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
  SET_PLAYGROUND_MODEL_TOOL_NAME,
} from "./constants";
import {
  parseListPlaygroundModelTargetsInput,
  parseSetPlaygroundModelInput,
} from "./parsers";
import type {
  ListPlaygroundModelTargetsInput,
  SetPlaygroundModelInput,
} from "./types";

export const setPlaygroundModelAgentTool =
  defineClientActionTool<SetPlaygroundModelInput>({
    name: SET_PLAYGROUND_MODEL_TOOL_NAME,
    parseInput: parseSetPlaygroundModelInput,
    invalidInputErrorText: `Invalid ${SET_PLAYGROUND_MODEL_TOOL_NAME} input. Expected { instanceId?: number, target: { type: "builtin", provider: string, modelName: string } | { type: "custom", customProviderId: string, modelName: string } }.`,
    notMountedErrorText:
      "The playground model selector is not mounted; cannot switch models.",
    defaultSuccessOutput: "Playground model updated.",
  });

export const listPlaygroundModelTargetsAgentTool =
  defineClientActionTool<ListPlaygroundModelTargetsInput>({
    name: LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
    parseInput: parseListPlaygroundModelTargetsInput,
    invalidInputErrorText: `Invalid ${LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The playground model selector is not mounted; cannot list available models.",
    defaultSuccessOutput: "Playground model targets listed.",
  });
