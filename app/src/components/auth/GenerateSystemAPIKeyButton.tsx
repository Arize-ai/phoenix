import { graphql, useMutation } from "react-relay";

import { Button } from "@phoenix/components";

import type { GenerateSystemAPIKeyButtonMutation } from "./__generated__/GenerateSystemAPIKeyButtonMutation.graphql";

type GenerateSystemAPIKeyButtonProps = {
  /**
   * Callback invoked when an API key is successfully generated.
   * @param apiKey - The generated JWT API key
   */
  onApiKeyGenerated: (apiKey: string) => void;
  /**
   * The name to give the generated API key.
   * @default "System Key"
   */
  keyName?: string;
  onError?: (message: string) => void;
  isDisabled?: boolean;
};

/**
 * A button that generates a system API key with default settings when clicked.
 * Handles its own mutation and loading state.
 */
export function GenerateSystemAPIKeyButton({
  onApiKeyGenerated,
  keyName = "System Key",
  onError,
  isDisabled,
}: GenerateSystemAPIKeyButtonProps) {
  const [commit, isCommitting] =
    useMutation<GenerateSystemAPIKeyButtonMutation>(graphql`
      mutation GenerateSystemAPIKeyButtonMutation($name: String!) {
        createSystemApiKey(input: { name: $name }) {
          jwt
          apiKey {
            id
          }
        }
      }
    `);

  const handlePress = () => {
    commit({
      variables: {
        name: keyName,
      },
      onCompleted: (response) => {
        onApiKeyGenerated(response.createSystemApiKey.jwt);
      },
      onError: (error) => {
        onError?.(error.message);
      },
    });
  };

  return (
    <Button
      size="S"
      onPress={handlePress}
      isDisabled={isCommitting || isDisabled}
    >
      {isCommitting ? "Generating..." : "Generate API Key"}
    </Button>
  );
}
