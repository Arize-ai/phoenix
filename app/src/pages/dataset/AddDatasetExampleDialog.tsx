import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { css } from "@emotion/react";

import { Card, CardProps, Dialog } from "@arizeai/components";

import {
  Alert,
  Button,
  FieldError,
  Flex,
  Icon,
  Icons,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

import { AddDatasetExampleDialogMutation } from "./__generated__/AddDatasetExampleDialogMutation.graphql";

type DatasetExamplePatch = {
  input: string;
  output: string;
  metadata: string;
  description?: string;
};

export type AddDatasetExampleDialogProps = {
  datasetId: string;
  onCompleted: () => void;
};

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  collapsible: true,
  bodyStyle: { padding: 0 },
};

export function AddDatasetExampleDialog(props: AddDatasetExampleDialogProps) {
  const { datasetId, onCompleted } = props;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [commit, isCommitting] = useMutation<AddDatasetExampleDialogMutation>(
    graphql`
      mutation AddDatasetExampleDialogMutation(
        $input: AddExamplesToDatasetInput!
      ) {
        addExamplesToDataset(input: $input) {
          __typename
        }
      }
    `
  );
  const {
    control,
    setError,
    handleSubmit,
    formState: { isValid },
  } = useForm<DatasetExamplePatch>({
    defaultValues: {
      input: "{}",
      output: "{}",
      metadata: "{}",
    },
  });

  const onSubmit = useCallback(
    (newExample: DatasetExamplePatch) => {
      setSubmitError(null);
      if (!isJSONObjectString(newExample?.input)) {
        return setError("input", {
          message: "Input must be a valid JSON object",
        });
      }
      if (!isJSONObjectString(newExample?.output)) {
        return setError("output", {
          message: "Output must be a valid JSON object",
        });
      }
      if (!isJSONObjectString(newExample?.metadata)) {
        return setError("metadata", {
          message: "Metadata must be a valid JSON object",
        });
      }

      commit({
        variables: {
          input: {
            datasetId,
            examples: [
              {
                input: JSON.parse(newExample.input),
                output: JSON.parse(newExample.output),
                metadata: JSON.parse(newExample.metadata),
              },
            ],
            datasetVersionDescription: newExample.description,
          },
        },
        onCompleted: () => {
          onCompleted();
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setSubmitError(formattedError?.[0] ?? error.message);
        },
      });
    },
    [commit, datasetId, setError, onCompleted]
  );
  return (
    <Dialog size="L" title={`Add Example`}>
      <div
        css={css`
          overflow-y: auto;
          padding: var(--ac-global-dimension-size-400);
        `}
      >
        <Flex direction="row" justifyContent="center">
          <View width="900px" paddingStart="auto" paddingEnd="auto">
            <Flex direction="column" gap="size-200">
              {submitError ? (
                <Alert variant="danger">{submitError}</Alert>
              ) : null}
              <Controller
                control={control}
                name={"input"}
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
                name={"output"}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { invalid, error },
                }) => (
                  <Card
                    title="Output"
                    subTitle="The output of the LLM or program to be used as an expected output"
                    {...defaultCardProps}
                    backgroundColor="green-100"
                    borderColor="green-700"
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
                name={"metadata"}
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
                name={"description"}
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
                    <Label>Version Description</Label>
                    <TextArea />
                    {error ? (
                      <FieldError>{error.message}</FieldError>
                    ) : (
                      <Text slot="description">
                        A description of the changes made. Will be displayed in
                        the version history.
                      </Text>
                    )}
                  </TextField>
                )}
              />
            </Flex>
          </View>
        </Flex>
      </div>
      <View padding="size-200" borderTopColor="light" borderTopWidth="thin">
        <Flex direction="row" justifyContent="end" gap="size-100">
          <Button
            variant="primary"
            size="S"
            isDisabled={!isValid || isCommitting}
            leadingVisual={
              isCommitting ? <Icon svg={<Icons.LoadingOutline />} /> : null
            }
            onPress={() => handleSubmit(onSubmit)()}
          >
            {isCommitting ? "Adding Example..." : "Add Example"}
          </Button>
        </Flex>
      </View>
    </Dialog>
  );
}
