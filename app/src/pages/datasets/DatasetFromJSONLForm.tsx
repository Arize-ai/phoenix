import { useCallback, useState } from "react";
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
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { ColumnMultiSelector } from "@phoenix/pages/datasets/ColumnMultiSelector";
import { prependBasename } from "@phoenix/utils/routingUtils";

type CreateDatasetFromJSONLParams = {
  file: FileList;
  input_keys: string[];
  output_keys: string[];
  metadata_keys: string[];
  split_keys: string[];
  name: string;
  description: string;
  metadata: Record<string, unknown>;
};

export type CreateDatasetFromJSONLFormProps = {
  onDatasetCreated: (dataset: { id: string; name: string }) => void;
  onDatasetCreateError: (error: Error) => void;
};

function getColumnNames(jsonlText: string) {
  const lines = jsonlText.split("\n");
  return Array.from(
    new Set(
      lines
        .filter((line) => line.trim() !== "")
        .map((line) => {
          const json = JSON.parse(line);
          return Object.keys(json);
        })
        .flat()
    )
  );
}

export function DatasetFromJSONLForm(props: CreateDatasetFromJSONLFormProps) {
  const { onDatasetCreated, onDatasetCreateError } = props;
  const [columns, setColumns] = useState<string[]>([]);
  const {
    control,
    handleSubmit,
    resetField,
    setValue,
    formState: { isDirty, isValid },
  } = useForm<CreateDatasetFromJSONLParams>({
    defaultValues: {
      name: "",
      input_keys: [],
      output_keys: [],
      metadata_keys: [],
      split_keys: [],
      description: "",
      metadata: {},
    },
  });

  const onSubmit = useCallback(
    (data: CreateDatasetFromJSONLParams) => {
      const formData = new FormData();
      formData.append("file", data.file[0]);
      formData.append("name", data.name);
      formData.append("description", data.description);
      formData.append("metadata", JSON.stringify(data.metadata));
      data.input_keys.forEach((key) => {
        formData.append("input_keys[]", key);
      });
      data.output_keys.forEach((key) => {
        formData.append("output_keys[]", key);
      });
      data.metadata_keys.forEach((key) => {
        formData.append("metadata_keys[]", key);
      });
      data.split_keys.forEach((key) => {
        formData.append("split_keys[]", key);
      });
      return fetch(prependBasename("/v1/datasets/upload?sync=true"), {
        method: "POST",
        body: formData,
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
    [onDatasetCreateError, onDatasetCreated]
  );
  return (
    <Form onSubmit={handleSubmit(onSubmit)} encType="multipart/form-data">
      <div
        css={css`
          padding: var(--ac-global-dimension-size-200);
          .ac-dropdown-button {
            width: 100%;
          }
        `}
      >
        <Controller
          control={control}
          name="file"
          rules={{ required: "JSONL file is required" }}
          render={({ field: { value: _value, onChange, ...field } }) => {
            return (
              <div
                css={css(
                  fieldBaseCSS,
                  css`
                    display: flex;
                    flex-direction: column;
                    gap: var(--ac-global-dimension-size-50);
                    margin-bottom: var(--ac-global-dimension-size-200);
                  `
                )}
              >
                <Label>JSONL file</Label>
                <input
                  {...field}
                  onChange={(event) => {
                    // Reset columns when a new file is uploaded
                    resetField("input_keys");
                    resetField("output_keys");
                    resetField("metadata_keys");
                    resetField("split_keys");

                    const userFile = event.target.files?.[0];
                    if (userFile) {
                      // clone the file with the application/jsonl content type
                      const newFile = new File([userFile], userFile.name, {
                        type: "application/jsonl",
                      });
                      onChange([newFile]);
                      const name = newFile.name.split(".")[0];
                      const reader = new FileReader();
                      reader.onload = function (e) {
                        if (!e.target) {
                          return;
                        }
                        const text = e.target.result;
                        const columnNames = getColumnNames(text as string);
                        setColumns(columnNames);
                        setValue("name", name);
                      };
                      reader.readAsText(newFile);
                    }
                  }}
                  type="file"
                  id="file"
                  accept=".jsonl"
                />
              </div>
            );
          }}
        />
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
              <Input placeholder="e.x. Golden Dataset" />
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
              <TextArea placeholder="e.x. A dataset for structured data extraction" />
              {error?.message ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">The description of the dataset</Text>
              )}
            </TextField>
          )}
        />

        <Controller
          name="input_keys"
          control={control}
          rules={{
            required: "field is required",
          }}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <ColumnMultiSelector
              label="input keys"
              description={`the keys to use as input`}
              columns={columns}
              selectedColumns={value}
              onChange={onChange}
              errorMessage={error?.message}
            />
          )}
        />
        <Controller
          name="output_keys"
          control={control}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <ColumnMultiSelector
              label="output keys"
              description={`the keys to use as output`}
              columns={columns}
              selectedColumns={value}
              onChange={onChange}
              errorMessage={error?.message}
            />
          )}
        />
        <Controller
          name="metadata_keys"
          control={control}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <ColumnMultiSelector
              label="metadata keys"
              description={`the keys to use as metadata`}
              columns={columns}
              selectedColumns={value}
              onChange={onChange}
              errorMessage={error?.message}
            />
          )}
        />
        <Controller
          name="split_keys"
          control={control}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <ColumnMultiSelector
              label="split keys"
              description={`the keys to use for automatically assigning examples to splits`}
              columns={columns}
              selectedColumns={value}
              onChange={onChange}
              errorMessage={error?.message}
            />
          )}
        />
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
            isDisabled={!isValid}
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
