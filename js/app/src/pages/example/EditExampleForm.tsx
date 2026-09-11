import { css } from "@emotion/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import type { CardProps } from "@phoenix/components";
import {
  Alert,
  Button,
  Card,
  DialogCloseButton,
  DialogHeader,
  DialogTitleExtra,
  FieldError,
  Flex,
  Icon,
  Icons,
  Label,
  Text,
  TextArea,
  TextField,
  TitleWithID,
  View,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

import type { EditExampleFormMutation } from "./__generated__/EditExampleFormMutation.graphql";

type ExamplePatch = {
  input: string;
  output: string;
  metadata: string;
  description?: string;
};

export type EditExampleFormProps = {
  exampleId: string;
  datasetId: string;
  currentRevision: ExamplePatch;
  onCancel: () => void;
  onCompleted: () => void;
};

const defaultCardProps: Partial<CardProps> = {
  collapsible: true,
};

export function EditExampleForm({
  exampleId,
  datasetId,
  currentRevision,
  onCancel,
  onCompleted,
}: EditExampleFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [commit, isCommitting] = useMutation<EditExampleFormMutation>(graphql`
    mutation EditExampleFormMutation($input: PatchDatasetExamplesInput!) {
      patchDatasetExamples(input: $input) {
        __typename
      }
    }
  `);
  const {
    clearErrors,
    control,
    setError,
    handleSubmit,
    formState: { isDirty },
  } = useForm<ExamplePatch>({
    defaultValues: currentRevision,
  });

  const submitChanges = (updatedExample: ExamplePatch) => {
    setSubmitError(null);
    clearErrors();
    if (!isJSONObjectString(updatedExample.input)) {
      setError("input", {
        message: "Input must be a valid JSON object",
      });
      return;
    }
    if (!isJSONObjectString(updatedExample.output)) {
      setError("output", {
        message: "Output must be a valid JSON object",
      });
      return;
    }
    if (!isJSONObjectString(updatedExample.metadata)) {
      setError("metadata", {
        message: "Metadata must be a valid JSON object",
      });
      return;
    }

    commit({
      variables: {
        input: {
          datasetId,
          patches: [
            {
              exampleId,
              input: JSON.parse(updatedExample.input),
              output: JSON.parse(updatedExample.output),
              metadata: JSON.parse(updatedExample.metadata),
            },
          ],
          versionDescription: updatedExample.description,
        },
      },
      onCompleted,
      onError: (error) => {
        setSubmitError(error.message);
      },
    });
  };

  return (
    <>
      <DialogHeader>
        <Flex direction="row" gap="size-200" alignItems="center">
          <DialogCloseButton />
          <TitleWithID title="Edit Example" id={exampleId} />
        </Flex>
        <DialogTitleExtra>
          <Button size="S" isDisabled={isCommitting} onPress={onCancel}>
            Cancel
          </Button>
          <Button
            variant={isDirty ? "primary" : "default"}
            size="S"
            isDisabled={!isDirty || isCommitting}
            leadingVisual={
              <Icon svg={isCommitting ? <Icons.Loading /> : <Icons.Save />} />
            }
            onPress={() => handleSubmit(submitChanges)()}
          >
            Save
          </Button>
        </DialogTitleExtra>
      </DialogHeader>
      {submitError ? (
        <View paddingX="size-200" paddingTop="size-100">
          <Alert variant="danger" banner>
            {submitError}
          </Alert>
        </View>
      ) : null}
      <div
        css={css`
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          padding: var(--global-dimension-size-400);
        `}
      >
        <Flex direction="row" justifyContent="center">
          <View width="900px" paddingStart="auto" paddingEnd="auto">
            <Flex direction="column" gap="size-200">
              <Controller
                control={control}
                name="input"
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { invalid, error },
                }) => (
                  <Card
                    title="Input"
                    subTitle="The input to the LLM, retriever, program, etc."
                    {...defaultCardProps}
                  >
                    {invalid ? (
                      <Alert variant="danger" banner>
                        {error?.message}
                      </Alert>
                    ) : null}
                    <JSONEditor
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  </Card>
                )}
              />
              <Controller
                control={control}
                name="output"
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { invalid, error },
                }) => (
                  <Card
                    title="Output"
                    subTitle="The output of the LLM or program to be used as an expected output"
                    {...defaultCardProps}
                    backgroundColor="green-200"
                    borderColor="green-300"
                  >
                    {invalid ? (
                      <Alert variant="danger" banner>
                        {error?.message}
                      </Alert>
                    ) : null}
                    <JSONEditor
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  </Card>
                )}
              />
              <Controller
                control={control}
                name="metadata"
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { invalid, error },
                }) => (
                  <Card
                    title="Metadata"
                    subTitle="All data from the span to use during experimentation or evaluation"
                    {...defaultCardProps}
                  >
                    {invalid ? (
                      <Alert variant="danger" banner>
                        {error?.message}
                      </Alert>
                    ) : null}
                    <JSONEditor
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  </Card>
                )}
              />
              <Controller
                control={control}
                name="description"
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { invalid, error },
                }) => (
                  <TextField
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    isInvalid={invalid}
                  >
                    <Label>Revision Description</Label>
                    <TextArea />
                    {error ? (
                      <FieldError>{error.message}</FieldError>
                    ) : (
                      <Text slot="description">
                        A description of the changes made in this revision. Will
                        be displayed in the version history.
                      </Text>
                    )}
                  </TextField>
                )}
              />
            </Flex>
          </View>
        </Flex>
      </div>
    </>
  );
}
