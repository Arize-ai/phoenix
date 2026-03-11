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
  Switch,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";

import type { EditInstanceDialogDeleteMutation } from "./__generated__/EditInstanceDialogDeleteMutation.graphql";
import type { EditInstanceDialogUpdateMutation } from "./__generated__/EditInstanceDialogUpdateMutation.graphql";
import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];
type ConfigInstanceInfo = AdapterInfo["configs"][number];

export function EditInstanceDialog({
  adapter,
  instance,
  allowDelete,
  onSaved,
}: {
  adapter: AdapterInfo;
  instance: ConfigInstanceInfo;
  allowDelete: boolean;
  onSaved: () => void;
}) {
  const instanceConfig =
    (instance.config as Record<string, string> | null) ?? {};
  const [name, setName] = useState(instance.name);
  const [description, setDescription] = useState(instance.description ?? "");
  const [configValues, setConfigValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      adapter.configFields.map((f) => [f.key, instanceConfig[f.key] ?? ""])
    )
  );
  const [timeout, setTimeout] = useState(instance.timeout);
  const [enabled, setEnabled] = useState(instance.enabled);
  const [error, setError] = useState<string | null>(null);

  const [commitUpdate, isUpdating] =
    useMutation<EditInstanceDialogUpdateMutation>(graphql`
      mutation EditInstanceDialogUpdateMutation($input: UpdateSandboxConfigInput!) {
        updateSandboxConfig(input: $input) {
          id
          backendType
          name
          description
          config
          timeout
          enabled
          configHash
        }
      }
    `);

  const [commitDelete, isDeleting] =
    useMutation<EditInstanceDialogDeleteMutation>(graphql`
      mutation EditInstanceDialogDeleteMutation($id: ID!) {
        deleteSandboxConfig(id: $id) {
          id
        }
      }
    `);

  const isBusy = isUpdating || isDeleting;

  const handleSave = useCallback(() => {
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const config: Record<string, string> = {};
    for (const field of adapter.configFields) {
      const val = configValues[field.key];
      if (val) {
        config[field.key] = val;
      }
    }

    commitUpdate({
      variables: {
        input: {
          id: instance.id,
          name: name.trim(),
          description: description.trim() || null,
          config,
          timeout,
          enabled,
        },
      },
      onCompleted: () => onSaved(),
      onError: (err) => setError(err.message),
    });
  }, [
    adapter,
    instance,
    name,
    description,
    configValues,
    timeout,
    enabled,
    commitUpdate,
    onSaved,
  ]);

  const handleDelete = useCallback(() => {
    setError(null);
    commitDelete({
      variables: { id: instance.id },
      onCompleted: () => onSaved(),
      onError: (err) => setError(err.message),
    });
  }, [instance, commitDelete, onSaved]);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit Config: {instance.name} ({adapter.label})
          </DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <TextField value={name} onChange={setName}>
              <Label>Name</Label>
              <Input />
            </TextField>
            <TextField value={description} onChange={setDescription}>
              <Label>Description (optional)</Label>
              <TextArea />
            </TextField>
            {adapter.configFields.map((field) => (
              <TextField
                key={field.key}
                value={configValues[field.key]}
                onChange={(val) =>
                  setConfigValues((prev) => ({ ...prev, [field.key]: val }))
                }
              >
                <Label>{field.label}</Label>
                <Input placeholder={field.placeholder} />
              </TextField>
            ))}
            <NumberField
              value={timeout}
              onChange={setTimeout}
              minValue={1}
              maxValue={300}
            >
              <Label>Timeout (seconds)</Label>
              <Input />
            </NumberField>
            <Flex direction="row" alignItems="center" gap="size-100">
              <Switch
                isSelected={enabled}
                onChange={setEnabled}
                aria-label="Enable config instance"
              >
                {null}
              </Switch>
              <Text size="S" color={enabled ? "text-700" : "text-300"}>
                {enabled ? "Enabled" : "Disabled"}
              </Text>
            </Flex>
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
                {isUpdating ? "Saving..." : "Save"}
              </Button>
              {allowDelete && (
                <Button
                  variant="default"
                  isDisabled={isBusy}
                  onPress={handleDelete}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              )}
            </Flex>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}
