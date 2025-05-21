import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Dropdown,
  DropdownProps,
  Field,
  FieldProps,
  Item,
  ListBox,
} from "@arizeai/components";

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
    formState: { isDirty, isValid },
  } = useForm<CreateDatasetFromCSVParams>({
    defaultValues: {
      name: "Dataset " + new Date().toISOString(),
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
          control={control}
          name="file"
          rules={{ required: "CSV file is required" }}
          render={({
            field: { value: _value, onChange, ...field },
            fieldState: { invalid, error },
          }) => {
            return (
              <Field
                label="CSV file"
                validationState={invalid ? "invalid" : "valid"}
                errorMessage={error?.message}
              >
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
                      const reader = new FileReader();
                      reader.onload = function (e) {
                        if (!e.target) {
                          return;
                        }
                        const text = e.target.result;
                        const columnNames = getColumnNames(text as string);
                        setColumns(columnNames);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  type="file"
                  id="file"
                  accept=".csv"
                />
              </Field>
            );
          }}
        />

        <Controller
          name="input_keys"
          control={control}
          rules={{
            required: "field is required",
          }}
          render={({
            field: { value, onChange },
            fieldState: { invalid, error },
          }) => (
            <ColumnMultiSelector
              label="input keys"
              validationState={invalid ? "invalid" : "valid"}
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
          render={({
            field: { value, onChange },
            fieldState: { invalid, error },
          }) => (
            <ColumnMultiSelector
              label="output keys"
              validationState={invalid ? "invalid" : "valid"}
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
          render={({
            field: { value, onChange },
            fieldState: { invalid, error },
          }) => (
            <ColumnMultiSelector
              label="metadata keys"
              validationState={invalid ? "invalid" : "valid"}
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

function ColumnMultiSelector(
  props: Omit<DropdownProps, "menu" | "children"> &
    Pick<
      FieldProps,
      "label" | "validationState" | "description" | "errorMessage"
    > & {
      label: string;
      columns: string[];
      selectedColumns: string[];
      onChange: (selectedColumns: string[]) => void;
    }
) {
  const {
    columns,
    selectedColumns,
    onChange,
    label,
    validationState,
    description,
    errorMessage,
    ...restProps
  } = props;
  const noColumns = columns.length === 0;
  const displayText = useMemo(() => {
    if (noColumns) {
      return "No columns to select";
    }
    return selectedColumns.length > 0
      ? `${selectedColumns.join(", ")}`
      : "No columns selected";
  }, [selectedColumns, noColumns]);
  return (
    <Field
      label={label}
      isDisabled={noColumns}
      validationState={validationState}
      description={description}
      errorMessage={errorMessage}
    >
      <Dropdown
        isDisabled={noColumns}
        {...restProps}
        menu={
          <ListBox
            selectionMode="multiple"
            onSelectionChange={(keys) => {
              onChange(Array.from(keys) as string[]);
            }}
            selectedKeys={new Set(selectedColumns)}
          >
            {columns.map((column) => (
              <Item key={column}>{column}</Item>
            ))}
          </ListBox>
        }
        triggerProps={{
          placement: "bottom end",
        }}
      >
        {displayText}
      </Dropdown>
    </Field>
  );
}
