import React from "react";
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

import { JSONEditor } from "@phoenix/components/code";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

import {
  EditDatasetFormMutation,
  EditDatasetFormMutation$variables,
} from "./__generated__/EditDatasetFormMutation.graphql";
import { metadataFieldWrapperCSS } from "./styles";

type PatchDatasetParams = Omit<EditDatasetFormMutation$variables, "datasetId">;

export function EditDatasetForm({
  datasetName,
  datasetId,
  datasetDescription,
  onDatasetEdited,
  onDatasetEditError,
  datasetMetadata,
}: {
  datasetName: string;
  datasetId: string;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onDatasetEdited: () => void;
  onDatasetEditError: (error: Error) => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<PatchDatasetParams>({
    defaultValues: {
      name: datasetName,
      description: datasetDescription,
      metadata: JSON.stringify(datasetMetadata, null, 2) ?? "{}",
    },
  });
  const [commit, isCommitting] = useMutation<EditDatasetFormMutation>(graphql`
    mutation EditDatasetFormMutation(
      $datasetId: GlobalID!
      $name: String!
      $description: String = null
      $metadata: JSON = null
    ) {
      patchDataset(
        input: {
          datasetId: $datasetId
          name: $name
          description: $description
          metadata: $metadata
        }
      ) {
        dataset {
          name
          description
          metadata
        }
      }
    }
  `);

  const onSubmit = (params: PatchDatasetParams) => {
    commit({
      variables: {
        datasetId,
        ...params,
        metadata: JSON.parse(params.metadata),
      },
      onCompleted: () => {
        onDatasetEdited();
      },
      onError: (error) => {
        onDatasetEditError(error);
      },
    });
  };

  return (
    <Form>
      <View padding="size-200">
        <Controller
          name="name"
          control={control}
          rules={{
            required: "Dataset name is required",
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
              value={value?.toString()}
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
                <JSONEditor
                  value={value}
                  onChange={onChange}
                  onBlur={onBlur}
                  width="100%"
                />
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
            disabled={!isDirty}
            variant={isDirty ? "primary" : "default"}
            size="compact"
            loading={isCommitting}
            onClick={handleSubmit(onSubmit)}
          >
            {isCommitting ? "Saving..." : "Save"}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
