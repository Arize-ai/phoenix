import React, { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "react-relay";
import { Form } from "react-router-dom";
import { graphql } from "relay-runtime";

import {
  Alert,
  Button,
  Dialog,
  Flex,
  TextArea,
  TextField,
  View,
} from "@arizeai/components";

import { CreateSystemAPIKeyDialogMutation } from "./__generated__/CreateSystemAPIKeyDialogMutation.graphql";

export type SystemKeyFormParams = {
  name: string;
  description: string | null;
};

/**
 * A dialog that allows admin users to create a system API key.
 * TODO: Add expiry date field
 */
export function CreateSystemAPIKeyDialog(props: {
  onSystemKeyCreated: (jwt: string) => void;
}) {
  const { onSystemKeyCreated } = props;
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm<SystemKeyFormParams>({
    defaultValues: {
      name: "System",
      description: "",
    },
  });

  const [commit, isCommitting] = useMutation<CreateSystemAPIKeyDialogMutation>(
    graphql`
      mutation CreateSystemAPIKeyDialogMutation(
        $name: String!
        $description: String = null
      ) {
        createSystemApiKey(input: { name: $name, description: $description }) {
          jwt
          query {
            ...SystemAPIKeysTableFragment
          }
        }
      }
    `
  );

  const onSubmit = useCallback(
    (data: SystemKeyFormParams) => {
      setError(null);
      commit({
        variables: data,
        onCompleted: (response) => {
          onSystemKeyCreated(response.createSystemApiKey.jwt);
        },
        onError: (error) => {
          setError(error.message);
        },
      });
    },
    [commit, onSystemKeyCreated]
  );

  return (
    <Dialog title="Create a System Key" isDismissable>
      {error && (
        <Alert variant="danger" banner>
          {error}
        </Alert>
      )}
      <Form onSubmit={handleSubmit(onSubmit)}>
        <View padding="size-200">
          <Controller
            name="name"
            control={control}
            rules={{
              required: "System key name is required",
            }}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextField
                label="Name"
                description="A short name to identify this key"
                errorMessage={error?.message}
                validationState={invalid ? "invalid" : "valid"}
                onChange={onChange}
                onBlur={onBlur}
                value={value.toString()}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextArea
                label="description"
                description={`A description of the system key`}
                isRequired={false}
                height={100}
                errorMessage={error?.message}
                validationState={invalid ? "invalid" : "valid"}
                onChange={onChange}
                onBlur={onBlur}
                value={value?.toString()}
              />
            )}
          />
        </View>
        <View
          paddingStart="size-200"
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderColor="dark"
          borderTopWidth="thin"
        >
          <Flex direction="row" gap="size-100" justifyContent="end">
            <Button
              variant={isDirty ? "primary" : "default"}
              type="submit"
              size="compact"
              disabled={!isValid || isCommitting}
            >
              {isCommitting ? "Creating..." : "Create Key"}
            </Button>
          </Flex>
        </View>
      </Form>
    </Dialog>
  );
}
