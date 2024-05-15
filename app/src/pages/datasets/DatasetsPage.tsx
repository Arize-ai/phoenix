import React, { ReactNode, Suspense, useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Form,
  Heading,
  TextArea,
  TextField,
  View,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";

import { DatasetsPageQuery } from "./__generated__/DatasetsPageQuery.graphql";
import { DatasetsTable } from "./DatasetsTable";

export function DatasetsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DatasetsPageContent />
    </Suspense>
  );
}

export function DatasetsPageContent() {
  const data = useLazyLoadQuery<DatasetsPageQuery>(
    graphql`
      query DatasetsPageQuery {
        ...DatasetsTable_datasets
      }
    `,
    {}
  );
  return (
    <div>
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
      >
        <Flex direction="row" justifyContent="space-between">
          <Heading level={1}>Datasets</Heading>
          <CreateDatasetButton />
        </Flex>
      </View>
      <DatasetsTable query={data} />
    </div>
  );
}

function CreateDatasetButton() {
  const {
    control,
    handleSubmit: handleSubmit,
    formState: { isDirty: isDirty, isValid: isValid },
  } = useForm({
    defaultValues: {
      name: "Dataset " + new Date().toISOString(),
      description: "",
    },
  });
  const onSubmit = useCallback(() => {
    // TODO: Implement mutation
  }, []);
  const [dialog, setDialog] = useState<ReactNode>(null);
  const onCreateDataset = () => {
    setDialog(
      <Dialog size="S" title="Create Dataset">
        <View padding="size-200">
          <Form onSubmit={handleSubmit(onSubmit)}>
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
                  height={200}
                  errorMessage={error?.message}
                  validationState={invalid ? "invalid" : "valid"}
                  onChange={onChange}
                  onBlur={onBlur}
                  value={value.toString()}
                />
              )}
            />
          </Form>
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
            >
              Create Dataset
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  };
  return (
    <>
      {/* Disabled until the mutation is created */}
      <Button variant="default" onClick={onCreateDataset}>
        Create Dataset
      </Button>
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => setDialog(null)}
      >
        {dialog}
      </DialogContainer>
    </>
  );
}
