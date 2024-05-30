import React, { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Card,
  CardProps,
  Dialog,
  Flex,
  Item,
  Picker,
  View,
} from "@arizeai/components";

import { JSONEditor } from "@phoenix/components/code";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

import { SpanToDatasetExampleDialogQuery } from "./__generated__/SpanToDatasetExampleDialogQuery.graphql";

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  collapsible: true,
  bodyStyle: { padding: 0 },
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
  onCompleted: () => void;
}) {
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const {
    span: { example },
    datasets,
  } = useLazyLoadQuery<SpanToDatasetExampleDialogQuery>(
    graphql`
      query SpanToDatasetExampleDialogQuery($spanId: GlobalID!) {
        span: node(id: $spanId) {
          ... on Span {
            example: asExample {
              input
              output
              metadata
            }
          }
        }
        datasets {
          edges {
            dataset: node {
              id
              name
            }
          }
        }
      }
    `,
    { spanId }
  );
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
      input: JSON.stringify(example?.input, null, 2),
      output: JSON.stringify(example?.output, null, 2),
      metadata: JSON.stringify(example?.metadata, null, 2),
      datasetId: "",
    },
  });

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
      if (!newExample?.datasetId) {
        return setError("datasetId", { message: "Dataset is required" });
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
          onCompleted();
        },
        onError: (error) => {
          setSubmitError(error.message);
        },
      });
    },
    [commit, setError, spanId, onCompleted]
  );
  return (
    <Dialog
      size="fullscreen"
      title="Add Example to Dataset"
      extra={
        <Button
          variant="primary"
          size="compact"
          disabled={!isValid || isCommitting}
          loading={isCommitting}
          onClick={handleSubmit(onSubmit)}
        >
          Add Example
        </Button>
      }
    >
      <div
        css={css`
          overflow-y: auto;
          padding: var(--ac-global-dimension-size-400);
          /* Make widths configurable */
          .dataset-picker {
            width: 100%;
            .ac-dropdown--picker,
            .ac-dropdown-button {
              width: 100%;
            }
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
                render={({
                  field: { onChange, onBlur },
                  fieldState: { invalid, error },
                }) => (
                  <Picker
                    label="dataset"
                    data-testid="dataset-picker"
                    className="dataset-picker"
                    width="100%"
                    aria-label={`The dataset to add the example to`}
                    onSelectionChange={(key) => {
                      onChange(key);
                    }}
                    placeholder="Select a dataset"
                    onBlur={onBlur}
                    isRequired
                    validationState={invalid ? "invalid" : "valid"}
                    errorMessage={error?.message}
                  >
                    {datasets.edges.map(({ dataset }) => (
                      <Item key={dataset.id}>{dataset.name}</Item>
                    ))}
                  </Picker>
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
    </Dialog>
  );
}
