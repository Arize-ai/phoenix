import { graphql, useMutation } from "react-relay";

import { Button } from "@phoenix/components";
import { useNotifyError } from "@phoenix/contexts";

import { GenerateSystemAPIKeyButtonMutation } from "./__generated__/GenerateSystemAPIKeyButtonMutation.graphql";

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
};

/**
 * A button that generates a system API key with default settings when clicked.
 * Handles its own mutation and loading state.
 */
export function GenerateSystemAPIKeyButton({
  onApiKeyGenerated,
  keyName = "System Key",
}: GenerateSystemAPIKeyButtonProps) {
  const notifyError = useNotifyError();

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
        notifyError({
          title: "Error creating system key",
          message: error.message,
        });
      },
    });
  };

  return (
    <Button size="S" onPress={handlePress} isDisabled={isCommitting}>
      {isCommitting ? "Generating..." : "Generate API Key"}
    </Button>
  );
}
