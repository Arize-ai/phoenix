import React, { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Flex,
  Form,
  TextArea,
  TextField,
  View,
} from "@arizeai/components";

import {
  CreateDatasetFormMutation,
  CreateDatasetFormMutation$data,
} from "./__generated__/CreateDatasetFormMutation.graphql";

type CreateDatasetParams = {
  name: string;
  description: string;
  metadata: Record<string, unknown>;
};

export type CreateDatasetFormProps = {
  onDatasetCreated: (
    dataset: CreateDatasetFormMutation$data["createDataset"]
  ) => void;
  onDatasetCreateError: (error: Error) => void;
};

export function CreateDatasetForm(props: CreateDatasetFormProps) {
  const { onDatasetCreated, onDatasetCreateError } = props;
  const {
    control,
    handleSubmit: handleSubmit,
    formState: { isDirty, isValid },
  } = useForm({
    defaultValues: {
      name: "Dataset " + new Date().toISOString(),
      description: "",
      metadata: {},
    } as CreateDatasetParams,
  });
  const [commit, isCommitting] = useMutation<CreateDatasetFormMutation>(graphql`
    mutation CreateDatasetFormMutation(
      $name: String!
      $description: String = null
      $metadata: JSON = null
    ) {
      createDataset(
        name: $name
        description: $description
        metadata: $metadata
      ) {
        id
        name
        description
      }
    }
  `);
  const onSubmit = useCallback(
    (params: CreateDatasetParams) => {
      commit({
        variables: params,
        onCompleted: (response) => {
          onDatasetCreated(response["createDataset"]);
        },
        onError: (error) => {
          // TODO(datasets): cleanup error handling to show human friendly error
          onDatasetCreateError(error);
        },
      });
    },
    [commit, onDatasetCreated, onDatasetCreateError]
  );
  return (
    <>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <View padding="size-200">
          <Controller
            name="name"
            control={control}
            rules={{
              required: "field is required",
            }}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextField
                label="Dataset Name"
                description={`The name of the dataset`}
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
                isRequired={false}
                height={100}
                errorMessage={error?.message}
                validationState={invalid ? "invalid" : "valid"}
                onChange={onChange}
                onBlur={onBlur}
                value={value.toString()}
              />
            )}
          />
        </View>
        <View
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderTopColor="light"
          borderTopWidth="thin"
        >
          <Flex direction="row" justifyContent="end">
            <Button
              type="submit"
              isDisabled={!isValid}
              variant={isDirty ? "primary" : "default"}
              size="compact"
              loading={isCommitting}
            >
              {isCommitting ? "Creating..." : "Create Dataset"}
            </Button>
          </Flex>
        </View>
      </Form>
    </>
  );
}
