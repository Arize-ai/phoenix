import { graphql, useFragment } from "react-relay";

import type { TextDiffStyle } from "@phoenix/components/diff";
import { TextDiff } from "@phoenix/components/diff";
import { readPromptInvocationParameters } from "@phoenix/pages/playground/PromptInvocationParametersReadableFragment";

import type {
  PromptVersionConfigDiffView__version$data,
  PromptVersionConfigDiffView__version$key,
} from "./__generated__/PromptVersionConfigDiffView__version.graphql";

type PromptVersionConfigData = PromptVersionConfigDiffView__version$data;

function promptToolsToJSON(tools: PromptVersionConfigData["tools"]) {
  if (tools == null) {
    return null;
  }
  return {
    tools: tools.tools.map((tool) => {
      if (tool.__typename === "PromptToolFunction") {
        return { type: "function", function: tool.function };
      }
      if (tool.__typename === "PromptToolRaw") {
        return tool.raw;
      }
      return {};
    }),
    tool_choice: tools.toolChoice ?? null,
    disable_parallel_tool_calls: tools.disableParallelToolCalls ?? null,
  };
}

/**
 * Serializes the model configuration of a prompt version (model, invocation
 * parameters, tools, response format) to stable, pretty-printed JSON for
 * line-based diffing.
 */
function promptVersionConfigToText(data: PromptVersionConfigData): string {
  const invocationParameters = readPromptInvocationParameters(
    data.invocationParameters
  );
  const config = {
    provider: data.modelProvider,
    model: data.modelName,
    invocation_parameters: invocationParameters?.parameters ?? {},
    tools: promptToolsToJSON(data.tools),
    response_format: data.responseFormat?.jsonSchema ?? null,
  };
  return JSON.stringify(config, null, 2);
}

const configFragment = graphql`
  fragment PromptVersionConfigDiffView__version on PromptVersion {
    modelName
    modelProvider
    invocationParameters {
      ...PromptInvocationParametersReadableFragment
    }
    tools {
      tools {
        __typename
        ... on PromptToolFunction {
          function {
            name
            description
            parameters
            strict
          }
        }
        ... on PromptToolRaw {
          raw
        }
      }
      toolChoice {
        type
        functionName
      }
      disableParallelToolCalls
    }
    responseFormat {
      jsonSchema {
        name
        description
        schema
        strict
      }
    }
  }
`;

/**
 * A git-like diff of the model configuration (model, invocation parameters,
 * tools, response format) between two prompt versions.
 */
export function PromptVersionConfigDiffView({
  current,
  baseline,
  diffStyle = "unified",
}: {
  current: PromptVersionConfigDiffView__version$key;
  baseline: PromptVersionConfigDiffView__version$key;
  diffStyle?: TextDiffStyle;
}) {
  const currentData = useFragment(configFragment, current);
  const baselineData = useFragment(configFragment, baseline);

  return (
    <TextDiff
      oldText={promptVersionConfigToText(baselineData)}
      newText={promptVersionConfigToText(currentData)}
      fileName="model-configuration.json"
      diffStyle={diffStyle}
    />
  );
}
