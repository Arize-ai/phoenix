import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  CredentialField,
  CredentialInput,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Label,
  Text,
  View,
} from "@phoenix/components";

import type { CredentialDialogDeleteMutation } from "./__generated__/CredentialDialogDeleteMutation.graphql";
import type { CredentialDialogSetMutation } from "./__generated__/CredentialDialogSetMutation.graphql";
import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];

export function CredentialDialog({
  adapter,
  onSaved,
}: {
  adapter: AdapterInfo;
  onSaved: () => void;
}) {
  const [credentialValue, setCredentialValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const primaryEnvVar = adapter.envVars[0] ?? null;

  const [commitSetCredential, isSettingCredential] =
    useMutation<CredentialDialogSetMutation>(graphql`
      mutation CredentialDialogSetMutation(
        $envVarName: String!
        $value: String!
      ) {
        setSandboxCredential(envVarName: $envVarName, value: $value)
      }
    `);

  const [commitDeleteCredential, isDeletingCredential] =
    useMutation<CredentialDialogDeleteMutation>(graphql`
      mutation CredentialDialogDeleteMutation($envVarName: String!) {
        deleteSandboxCredential(envVarName: $envVarName)
      }
    `);

  const isBusy = isSettingCredential || isDeletingCredential;

  const handleSave = useCallback(() => {
    if (!primaryEnvVar) return;
    setError(null);

    if (credentialValue) {
      commitSetCredential({
        variables: { envVarName: primaryEnvVar.name, value: credentialValue },
        onCompleted: () => onSaved(),
        onError: (err) => setError(err.message),
      });
    } else {
      commitDeleteCredential({
        variables: { envVarName: primaryEnvVar.name },
        onCompleted: () => onSaved(),
        onError: (err) => setError(err.message),
      });
    }
  }, [
    primaryEnvVar,
    credentialValue,
    commitSetCredential,
    commitDeleteCredential,
    onSaved,
  ]);

  if (!primaryEnvVar) return null;

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credentials: {adapter.label}</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <CredentialField
              value={credentialValue}
              onChange={setCredentialValue}
            >
              <Label>{primaryEnvVar.description || primaryEnvVar.name}</Label>
              <CredentialInput placeholder={`Enter ${primaryEnvVar.name}`} />
            </CredentialField>
            {error != null && (
              <Text size="S" color="danger">
                {error}
              </Text>
            )}
            <Flex direction="row" gap="size-100">
              <Button
                variant="primary"
                isDisabled={isBusy}
                onPress={handleSave}
              >
                {isBusy ? "Saving..." : "Save"}
              </Button>
            </Flex>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}
