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
  TextArea,
  TextField,
  View,
} from "@phoenix/components";

import type { CreateInstanceDialogMutation } from "./__generated__/CreateInstanceDialogMutation.graphql";
import type { SandboxBackendType } from "./__generated__/SettingsSandboxPageQuery.graphql";
import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];

export function CreateInstanceDialog({
  adapter,
  onSaved,
}: {
  adapter: AdapterInfo;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(adapter.configFields.map((f) => [f.key, ""]))
  );
  const [timeout, setTimeout] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const [commitCreate, isCreating] =
    useMutation<CreateInstanceDialogMutation>(graphql`
      mutation CreateInstanceDialogMutation($input: CreateSandboxConfigInput!) {
        createSandboxConfig(input: $input) {
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

  const handleCreate = useCallback(() => {
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

    commitCreate({
      variables: {
        input: {
          backendType: adapter.key as SandboxBackendType,
          name: name.trim(),
          description: description.trim() || null,
          config,
          timeout,
        },
      },
      onCompleted: () => onSaved(),
      onError: (err) => setError(err.message),
    });
  }, [
    adapter,
    name,
    description,
    configValues,
    timeout,
    commitCreate,
    onSaved,
  ]);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Config: {adapter.label}</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <TextField value={name} onChange={setName}>
              <Label>Name</Label>
              <Input placeholder="e.g. production, staging" />
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
            {error != null && (
              <Text size="S" color="danger">
                {error}
              </Text>
            )}
            <Flex direction="row" gap="size-100">
              <Button
                variant="primary"
                isDisabled={isCreating}
                onPress={handleCreate}
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </Flex>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}
