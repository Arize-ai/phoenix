import { useCallback, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Card,
  CardProps,
  Dialog,
  Flex,
  Icon,
  Icons,
  View,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { DatasetSelect, NewDatasetButton } from "@phoenix/components/dataset";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

import { SpanToDatasetExampleDialogQuery } from "./__generated__/SpanToDatasetExampleDialogQuery.graphql";

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  collapsible: true,
};

type ExampleToAdd = {
  input: string;
  output: string;
  metadata: string;
  datasetId: string;
};

export function SpanToDatasetExampleDialog({
  spanId,
  onCompleted,
}: {
  spanId: string;
  onCompleted: (datasetId: string) => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const data = useLazyLoadQuery<SpanToDatasetExampleDialogQuery>(
    graphql`
      query SpanToDatasetExampleDialogQuery($spanId: ID!) {
        span: node(id: $spanId) {
          ... on Span {
            revision: asExampleRevision {
              input
              output
              metadata
            }
          }
        }
      }
    `,
    { spanId },
    { fetchPolicy: "store-and-network" }
  );
  const {
    span: { revision },
  } = data;
  const [commit, isCommitting] = useMutation(graphql`
    mutation SpanToDatasetExampleDialogAddExampleToDatasetMutation(
      $input: AddExamplesToDatasetInput!
    ) {
      addExamplesToDataset(input: $input) {
        dataset {
          id
        }
      }
    }
  `);
  const {
    control,
    setError,
    handleSubmit,
    formState: { isValid },
  } = useForm<ExampleToAdd>({
    defaultValues: {
      input: JSON.stringify(revision?.input, null, 2),
      output: JSON.stringify(revision?.output, null, 2),
      metadata: JSON.stringify(revision?.metadata, null, 2),
      datasetId: "",
    },
  });

  const datasetId = useWatch({ control, name: "datasetId" });

  const onSubmit = useCallback(
    (newExample: ExampleToAdd) => {
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
            datasetId: newExample.datasetId,
            examples: [
              {
                input: JSON.parse(newExample.input),
                output: JSON.parse(newExample.output),
                metadata: JSON.parse(newExample.metadata),
                spanId,
              },
            ],
          },
        },
        onCompleted: () => {
          onCompleted(newExample.datasetId);
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setSubmitError(formattedError?.[0] ?? error.message);
        },
      });
    },
    [commit, setError, spanId, onCompleted]
  );
  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Example to Dataset</DialogTitle>
            <DialogTitleExtra>
              <Button
                variant="primary"
                size="S"
                isDisabled={!isValid || isCommitting || !datasetId}
                onPress={() => {
                  handleSubmit(onSubmit)();
                  close();
                }}
                leadingVisual={
                  <Icon
                    svg={
                      isCommitting ? (
                        <Icons.LoadingOutline />
                      ) : (
                        <Icons.PlusOutline />
                      )
                    }
                  />
                }
              >
                Add Example
              </Button>
              <DialogCloseButton slot="close" />
            </DialogTitleExtra>
          </DialogHeader>
          <div
            css={css`
              overflow-y: auto;
              padding: var(--ac-global-dimension-size-400);
              /* Make widths configurable */
              .dataset-picker {
                width: 100%;
              }
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
                    name="datasetId"
                    rules={{ required: "Dataset is required" }}
                    render={({
                      field: { onChange, onBlur, value },
                      fieldState: { invalid, error },
                    }) => (
                      <Flex direction="row" gap="size-100" alignItems="end">
                        <DatasetSelect
                          isRequired
                          onChange={onChange}
                          onBlur={onBlur}
                          validationState={invalid ? "invalid" : "valid"}
                          errorMessage={error?.message}
                          label="Dataset"
                          value={value}
                        />
                        <NewDatasetButton
                          onDatasetCreated={(id) => {
                            onChange(id);
                          }}
                        />
                      </Flex>
                    )}
                  />

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
                </Flex>
              </View>
            </Flex>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
