import { graphql, useMutation } from "react-relay";

import { Button } from "@phoenix/components";
import { useNotifyError } from "@phoenix/contexts";

import { GeneratePersonalAPIKeyButtonMutation } from "./__generated__/GeneratePersonalAPIKeyButtonMutation.graphql";

type GeneratePersonalAPIKeyButtonProps = {
  /**
   * Callback invoked when an API key is successfully generated.
   * @param apiKey - The generated JWT API key
   */
  onApiKeyGenerated: (apiKey: string) => void;
  /**
   * The name to give the generated API key.
   * @default "Personal Key"
   */
  keyName?: string;
};

/**
 * A button that generates a personal/user API key with default settings when clicked.
 * Handles its own mutation and loading state.
 */
export function GeneratePersonalAPIKeyButton({
  onApiKeyGenerated,
  keyName = "Personal Key",
}: GeneratePersonalAPIKeyButtonProps) {
  const notifyError = useNotifyError();

  const [commit, isCommitting] =
    useMutation<GeneratePersonalAPIKeyButtonMutation>(graphql`
      mutation GeneratePersonalAPIKeyButtonMutation(
        $input: CreateUserApiKeyInput!
      ) {
        createUserApiKey(input: $input) {
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
        input: {
          name: keyName,
        },
      },
      onCompleted: (response) => {
        onApiKeyGenerated(response.createUserApiKey.jwt);
      },
      onError: (error) => {
        notifyError({
          title: "Error creating personal key",
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
