import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME } from "./constants";
import { parseSetPlaygroundExperimentRecordingInput } from "./parsers";
import type { SetPlaygroundExperimentRecordingInput } from "./types";

export const setPlaygroundExperimentRecordingAgentTool =
  defineClientActionTool<SetPlaygroundExperimentRecordingInput>({
    name: SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME,
    parseInput: parseSetPlaygroundExperimentRecordingInput,
    invalidInputErrorText: `Invalid ${SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME} input. Expected { recordExperiments: boolean }.`,
    notMountedErrorText:
      "The playground is not mounted; cannot set playground experiment recording.",
    defaultSuccessOutput: "Playground experiment recording updated.",
  });
