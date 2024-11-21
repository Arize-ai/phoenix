import { useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { Mutable } from "@phoenix/typeUtils";

import { ModelSupportedParamsFetcherQuery } from "./__generated__/ModelSupportedParamsFetcherQuery.graphql";

export const ModelSupportedParamsFetcher = ({
  instanceId,
}: {
  instanceId: number;
}) => {
  const modelProvider = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)?.model
        .provider
  );
  const modelName = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)?.model
        .modelName
  );
  const updateModelSupportedInvocationParameters = usePlaygroundContext(
    (state) => state.updateModelSupportedInvocationParameters
  );
  const { modelInvocationParameters } =
    useLazyLoadQuery<ModelSupportedParamsFetcherQuery>(
      graphql`
        query ModelSupportedParamsFetcherQuery($input: ModelsInput!) {
          modelInvocationParameters(input: $input) {
            __typename
            ... on InvocationParameterBase {
              invocationName
              canonicalName
              required
            }
          }
        }
      `,
      {
        input: {
          providerKey: modelProvider,
          modelName,
        },
      }
    );
  useEffect(() => {
    updateModelSupportedInvocationParameters({
      instanceId,
      supportedInvocationParameters: modelInvocationParameters as Mutable<
        typeof modelInvocationParameters
      >,
    });
  }, [
    modelInvocationParameters,
    instanceId,
    updateModelSupportedInvocationParameters,
  ]);
  return null;
};
