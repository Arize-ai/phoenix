import React, { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Field,
  Flex,
  Form,
  TextArea,
  TextField,
  View,
} from "@arizeai/components";

import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

import { JSONEditor } from "../code";

import {
  CreateDatasetFormMutation,
  CreateDatasetFormMutation$data,
} from "./__generated__/CreateDatasetFormMutation.graphql";
import { metadataFieldWrapperCSS } from "./styles";

type CreateDatasetParams = {
  name: string;
  description: string;
  metadata: string;
};

export type CreateDatasetFormProps = {
  onDatasetCreated: (
    dataset: CreateDatasetFormMutation$data["createDataset"]["dataset"]
  ) => void;
  onDatasetCreateError: (error: Error) => void;
};

export function CreateDatasetForm(props: CreateDatasetFormProps) {
  const { onDatasetCreated, onDatasetCreateError } = props;
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm({
    defaultValues: {
      name: "Dataset " + new Date().toISOString(),
      description: "",
      metadata: "{}",
    } as CreateDatasetParams,
  });
  const [commit, isCommitting] = useMutation<CreateDatasetFormMutation>(graphql`
    mutation CreateDatasetFormMutation(
      $name: String!
      $description: String = null
      $metadata: JSON = null
    ) {
      createDataset(
        input: { name: $name, description: $description, metadata: $metadata }
      ) {
        dataset {
          id
          name
          description
          metadata
          createdAt
          exampleCount
          experimentCount
        }
      }
    }
  `);
  const onSubmit = useCallback(
    (params: CreateDatasetParams) => {
      commit({
        variables: { ...params, metadata: JSON.parse(params.metadata) },
        onCompleted: (response) => {
          onDatasetCreated(response["createDataset"]["dataset"]);
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
        <Controller
          name="metadata"
          control={control}
          rules={{
            validate: (value) => {
              if (!isJSONObjectString(value)) {
                return "metadata must be a valid JSON object";
              }
              return true;
            },
          }}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <div css={metadataFieldWrapperCSS}>
              <Field
                label={"metadata"}
                validationState={invalid ? "invalid" : "valid"}
                errorMessage={error?.message}
              >
                <JSONEditor value={value} onChange={onChange} onBlur={onBlur} />
              </Field>
            </div>
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
  );
}
