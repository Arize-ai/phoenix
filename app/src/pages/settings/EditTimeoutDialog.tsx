import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Input,
  Label,
  NumberField,
  Text,
  View,
} from "@phoenix/components";

import type { EditTimeoutDialogMutation } from "./__generated__/EditTimeoutDialogMutation.graphql";
import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];
type ConfigInstanceInfo = AdapterInfo["configs"][number];

export function EditTimeoutDialog({
  adapter,
  instance,
  onSaved,
}: {
  adapter: AdapterInfo;
  instance: ConfigInstanceInfo;
  onSaved: () => void;
}) {
  const [timeout, setTimeout] = useState(instance.timeout);
  const [error, setError] = useState<string | null>(null);

  const [commitUpdate, isUpdating] =
    useMutation<EditTimeoutDialogMutation>(graphql`
      mutation EditTimeoutDialogMutation($input: UpdateSandboxConfigInput!) {
        updateSandboxConfig(input: $input) {
          id
          timeout
        }
      }
    `);

  const handleSave = useCallback(() => {
    setError(null);
    commitUpdate({
      variables: { input: { id: instance.id, timeout } },
      onCompleted: () => onSaved(),
      onError: (err) => setError(err.message),
    });
  }, [instance, timeout, commitUpdate, onSaved]);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit Timeout: {instance.name} ({adapter.label})
          </DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <NumberField
              value={timeout}
              onChange={setTimeout}
              minValue={1}
              maxValue={300}
            >
              <Label>Timeout (seconds)</Label>
              <Input />
            </NumberField>
            {error != null && (
              <Text size="S" color="danger">
                {error}
              </Text>
            )}
            <Flex direction="row" gap="size-100">
              <Button
                variant="primary"
                isDisabled={isUpdating}
                onPress={handleSave}
              >
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            </Flex>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}
