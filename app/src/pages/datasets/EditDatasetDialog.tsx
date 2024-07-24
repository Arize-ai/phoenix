import React from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  Flex,
  Form,
  TextArea,
  TextField,
  View,
} from "@arizeai/components";

import {
  EditDatasetDialogMutation,
  EditDatasetDialogMutation$variables,
} from "./__generated__/EditDatasetDialogMutation.graphql";

type PatchDatasetParams = Omit<
  EditDatasetDialogMutation$variables,
  "datasetId"
>;

function EditDatasetForm({
  datasetName,
  datasetId,
  datasetDescription,
  onDatasetEdited,
  onDatasetEditError,
}: {
  datasetName: string;
  datasetId: string;
  datasetDescription?: string | null;
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
    },
  });
  const [commit, isCommitting] = useMutation<EditDatasetDialogMutation>(graphql`
    mutation EditDatasetDialogMutation(
      $datasetId: GlobalID!
      $name: String!
      $description: String = null
    ) {
      patchDataset(
        input: { datasetId: $datasetId, name: $name, description: $description }
      ) {
        dataset {
          name
          description
        }
      }
    }
  `);

  const onSubmit = (params: PatchDatasetParams) => {
    commit({
      variables: { datasetId, ...params },
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

export function EditDatasetDialog({
  datasetName,
  datasetId,
  datasetDescription,
  onDatasetEdited,
  onDatasetEditError,
}: {
  datasetName: string;
  datasetId: string;
  datasetDescription?: string | null;
  onDatasetEdited: () => void;
  onDatasetEditError: (error: Error) => void;
}) {
  return (
    <Dialog title={"Edit Dataset"} size="M">
      <EditDatasetForm
        datasetName={datasetName}
        datasetId={datasetId}
        datasetDescription={datasetDescription}
        onDatasetEdited={onDatasetEdited}
        onDatasetEditError={onDatasetEditError}
      />
    </Dialog>
  );
}
