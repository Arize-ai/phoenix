import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectValue,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { prependBasename } from "@phoenix/utils/routingUtils";

type CreateDatasetFromCSVParams = {
  file: FileList;
  input_keys: string[];
  output_keys: string[];
  metadata_keys: string[];
  name: string;
  description: string;
  metadata: Record<string, unknown>;
};

export type CreateDatasetFromCSVFormProps = {
  onDatasetCreated: (dataset: { id: string; name: string }) => void;
  onDatasetCreateError: (error: Error) => void;
};

function getColumnNames(csvText: string) {
  const lines = csvText.split("\n");
  if (lines.length > 0) {
    return lines[0].split(",").map((name) => name.trim());
  }
  return [];
}

export function DatasetFromCSVForm(props: CreateDatasetFromCSVFormProps) {
  const { onDatasetCreated, onDatasetCreateError } = props;
  const [columns, setColumns] = useState<string[]>([]);
  const {
    control,
    handleSubmit,
    resetField,
    setValue,
    formState: { isDirty, isValid },
  } = useForm<CreateDatasetFromCSVParams>({
    defaultValues: {
      name: "",
      input_keys: [],
      output_keys: [],
      metadata_keys: [],
      description: "",
      metadata: {},
    },
  });

  const onSubmit = useCallback(
    (data: CreateDatasetFromCSVParams) => {
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
    <Form onSubmit={handleSubmit(onSubmit)}>
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
          rules={{ required: "CSV file is required" }}
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
                <Label>CSV file</Label>
                <input
                  {...field}
                  onChange={(event) => {
                    onChange(event.target.files);
                    // Reset columns when a new file is uploaded
                    resetField("input_keys");
                    resetField("output_keys");
                    resetField("metadata_keys");
                    const file = event.target.files?.[0];
                    if (file) {
                      const name = file.name.split(".")[0];
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
                      reader.readAsText(file);
                    }
                  }}
                  type="file"
                  id="file"
                  accept=".csv"
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
              description={`the columns to use as input`}
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
              description={`the columns to use as output`}
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
              description={`the columns to use as metadata`}
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

function ColumnMultiSelector(props: {
  description?: string;
  errorMessage?: string;
  label: string;
  columns: string[];
  selectedColumns: string[];
  onChange: (selectedColumns: string[]) => void;
}) {
  const {
    columns,
    selectedColumns,
    onChange,
    label,
    description,
    errorMessage,
  } = props;
  const noColumns = columns.length === 0;
  const items = useMemo(() => {
    return columns.map((column) => ({ id: column, value: column }));
  }, [columns]);

  return (
    <div css={fieldBaseCSS}>
      <Label>{label}</Label>
      <Select
        isDisabled={noColumns}
        placeholder="Select columns"
        selectionMode="multiple"
        onChange={(keys) => {
          if (keys === "all") {
            return onChange(columns);
          }
          return onChange(Array.from(keys as string[]));
        }}
        value={selectedColumns}
      >
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Popover>
          <ListBox
            renderEmptyState={() => "No columns to select"}
            items={items}
          >
            {(item) => <ListBoxItem id={item.id}>{item.value}</ListBoxItem>}
          </ListBox>
        </Popover>
      </Select>
      {errorMessage ? (
        <Text slot="errorMessage" color="danger">
          {errorMessage}
        </Text>
      ) : null}
      {description && !errorMessage ? (
        <Text slot="description">{description}</Text>
      ) : null}
    </div>
  );
}
