import { LoaderFunctionArgs } from "react-router-dom";
import { fetchQuery, graphql } from "relay-runtime";

import {
  fetchPlaygroundPromptAsInstance,
  objectToInvocationParameters,
} from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { promptPlaygroundLoaderQuery } from "@phoenix/pages/prompt/__generated__/promptPlaygroundLoaderQuery.graphql";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import { Mutable } from "@phoenix/typeUtils";

export const promptPlaygroundLoader = async ({
  params,
}: LoaderFunctionArgs) => {
  const { promptId } = params;
  if (!promptId) {
    throw new Error("Prompt ID is required");
  }
  const response = await fetchPlaygroundPromptAsInstance(promptId);
  if (!response) {
    throw new Error("Prompt not found");
  }
  const supportedInvocationParametersResponse =
    await fetchQuery<promptPlaygroundLoaderQuery>(
      RelayEnvironment,
      graphql`
        query promptPlaygroundLoaderQuery($modelsInput: ModelsInput!) {
          modelInvocationParameters(input: $modelsInput) {
            __typename
            ... on InvocationParameterBase {
              invocationName
              canonicalName
              required
              label
            }
            # defaultValue must be aliased because Relay will not create a union type for fields with the same name
            # follow the naming convention of the field type e.g. floatDefaultValue for FloatInvocationParameter
            # default value mapping elsewhere in playground code relies on this naming convention
            # https://github.com/facebook/relay/issues/3776
            ... on BooleanInvocationParameter {
              booleanDefaultValue: defaultValue
              invocationInputField
            }
            ... on BoundedFloatInvocationParameter {
              floatDefaultValue: defaultValue
              invocationInputField
              minValue
              maxValue
            }
            ... on FloatInvocationParameter {
              floatDefaultValue: defaultValue
              invocationInputField
            }
            ... on IntInvocationParameter {
              intDefaultValue: defaultValue
              invocationInputField
            }
            ... on JSONInvocationParameter {
              jsonDefaultValue: defaultValue
              invocationInputField
            }
            ... on StringInvocationParameter {
              stringDefaultValue: defaultValue
              invocationInputField
            }
            ... on StringListInvocationParameter {
              stringListDefaultValue: defaultValue
              invocationInputField
            }
          }
        }
      `,
      {
        modelsInput: {
          modelName: response.instance.model.modelName,
          providerKey: response.instance.model.provider,
        },
      }
    ).toPromise();

  const supportedInvocationParameters =
    supportedInvocationParametersResponse?.modelInvocationParameters as
      | Mutable<
          NonNullable<
            typeof supportedInvocationParametersResponse
          >["modelInvocationParameters"]
        >
      | undefined;

  const instance = {
    ...response.instance,
    model: {
      ...response.instance.model,
      supportedInvocationParameters: supportedInvocationParameters || [],
      invocationParameters: objectToInvocationParameters(
        {
          ...response.promptVersion.invocationParameters,
          ...(response.promptVersion.outputSchema?.definition
            ? {
                response_format: response.promptVersion.outputSchema.definition,
              }
            : {}),
        },
        supportedInvocationParameters || []
      ),
    },
  };
  return { instanceWithPrompt: instance };
};

export type PromptPlaygroundLoaderData = Awaited<
  ReturnType<typeof promptPlaygroundLoader>
>;
