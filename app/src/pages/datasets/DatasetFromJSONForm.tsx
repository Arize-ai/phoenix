import React, { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { prependBasename } from "@phoenix/utils/routingUtils";

type CreateDatasetFromJSONParams = {
  file: FileList;
  name: string;
  description: string;
};

type JsonData = {
  name: string;
  description: string;
  inputs: Record<string, unknown>[];
  outputs: Record<string, unknown>[];
  metadata: Record<string, unknown>[];
};

export type CreateDatasetFromJSONFormProps = {
  onDatasetCreated: (dataset: { id: string; name: string }) => void;
  onDatasetCreateError: (error: Error) => void;
};

export function DatasetFromJSONForm(props: CreateDatasetFromJSONFormProps) {
  const { onDatasetCreated, onDatasetCreateError } = props;
  const [jsonData, setJsonData] = useState<JsonData | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm<CreateDatasetFromJSONParams>({
    defaultValues: {
      name: "Dataset " + new Date().toISOString(),
      description: "",
      file: undefined,
    },
  });

  const onSubmit = useCallback(
    (data: CreateDatasetFromJSONParams) => {
      if (!jsonData) {
        onDatasetCreateError(new Error("No JSON file has been uploaded"));
        return;
      }

      return fetch(prependBasename("/v1/datasets/upload?sync=true"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...jsonData,
          name: data.name,
          description: data.description,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw onDatasetCreateError(
              new Error(response.statusText || "Failed to create dataset")
            );
          }
          return response.json();
        })
        .then((res) => {
          onDatasetCreated({
            name: data.name,
            id: res["data"]["dataset_id"],
          });
        });
    },
    [onDatasetCreateError, onDatasetCreated, jsonData]
  );

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <div
        css={css`
          padding: var(--ac-global-dimension-size-200);
        `}
      >
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
              isInvalid={invalid}
              onChange={onChange}
              onBlur={onBlur}
              value={value.toString()}
            >
              <Label>Dataset Name</Label>
              <Input placeholder="e.g., Golden Dataset" />
              {error?.message ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">The name of the dataset</Text>
              )}
            </TextField>
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              isInvalid={invalid}
              onChange={onChange}
              onBlur={onBlur}
              value={value.toString()}
            >
              <Label>Description</Label>
              <TextArea placeholder="e.g., A dataset for structured data extraction" />
              {error?.message ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">The description of the dataset</Text>
              )}
            </TextField>
          )}
        />
        <Controller
          control={control}
          name="file"
          rules={{ required: "JSON file is required" }}
          render={({
            field: { value: _value, onChange, ...field },
            fieldState: { invalid, error },
          }) => {
            return (
              <TextField isInvalid={invalid}>
                <Label>JSON file</Label>
                <input
                  {...field}
                  onChange={(event) => {
                    onChange(event.target.files);
                    const file = event.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = function (e) {
                        if (!e.target) {
                          return;
                        }
                        try {
                          const parsedData = JSON.parse(
                            e.target.result as string
                          );
                          setJsonData(parsedData);
                        } catch (error) {
                          onDatasetCreateError(
                            new Error(
                              "Invalid JSON file: " + (error as Error).message
                            )
                          );
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  type="file"
                  id="file"
                  accept=".json"
                />
                {error?.message ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">Upload a JSON file.</Text>
                )}
              </TextField>
            );
          }}
        />
        <div
          css={css`
            margin-top: var(--ac-global-dimension-size-200);
          `}
        >
          <Text>Example JSON file:</Text>
          <JSONBlock
            value={JSON.stringify(
              {
                inputs: [
                  {
                    question: "What is the format of a JSON dataset file?",
                  },
                ],
                outputs: [
                  {
                    answer: "inputs, outputs, and metadata as lists of objects",
                  },
                ],
                metadata: [
                  {
                    hint: "outputs and metadata are optional",
                  },
                ],
              },
              null,
              2
            )}
          />
        </div>
      </div>
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
            isDisabled={!isValid || !jsonData}
            variant={isDirty ? "primary" : "default"}
            size="S"
          >
            Create Dataset
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
