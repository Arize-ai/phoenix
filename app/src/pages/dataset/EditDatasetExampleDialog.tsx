import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Card,
  CardProps,
  Dialog,
  Flex,
  View,
} from "@arizeai/components";

import { JSONEditor } from "@phoenix/components/code";

type DatasetExamplePatch = {
  input: string;
  output: string;
  metadata: string;
};

export type EditDatasetExampleDialogProps = {
  exampleId: string;
  currentRevision: DatasetExamplePatch;
  onCompleted: () => void;
};

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  collapsible: true,
  bodyStyle: { padding: 0 },
};

export function EditDatasetExampleDialog(props: EditDatasetExampleDialogProps) {
  const { exampleId } = props;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    setError,
    handleSubmit,
    formState: { isValid },
  } = useForm<DatasetExamplePatch>({
    defaultValues: props.currentRevision,
  });

  return (
    <Dialog
      size="fullscreen"
      title={`Edit Example: ${exampleId}`}
      extra={
        <Button variant="primary" size="compact">
          Save Changes
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
