import { Control, Controller } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Flex,
  Heading,
  Icon,
  Icons,
  Input,
  NumberField,
} from "@phoenix/components";
import { ModelFormParams } from "@phoenix/pages/settings/ModelForm";
import { ModelTokenTypeComboBox } from "@phoenix/pages/settings/ModelTokenTypeComboBox";

export function ModelTokenCostControlTable({
  title,
  namePrefix,
  fields,
  control,
  tokenTypeOptions,
  onAppend,
  onRemove,
  appendKind,
}: {
  title: string;
  namePrefix: "promptCosts" | "completionCosts";
  fields: { id: string }[];
  control: Control<ModelFormParams>;
  tokenTypeOptions: { name: string; kind: "prompt" | "completion" }[];
  onAppend: (obj: {
    kind: "prompt" | "completion";
    name: string;
    cost: number;
  }) => void;
  onRemove: (index: number) => void;
  appendKind: "prompt" | "completion";
}) {
  return (
    <>
      <Heading level={3} weight="heavy">
        {title}
      </Heading>

      <table
        css={css`
          border-collapse: separate;
          border-spacing: 0 var(--ac-global-dimension-size-100);
          width: 100%;

          & th {
            text-align: left;
            font-weight: normal;
            color: var(--ac-global-color-grey-500);
          }

          & th:not(:last-child) {
            padding-right: var(--ac-global-dimension-size-100);
          }

          & td {
            vertical-align: top;
          }

          & tbody td:not(:last-child) {
            padding-right: var(--ac-global-dimension-size-100);
          }

          & tbody td:last-child {
            vertical-align: middle;
          }
        `}
      >
        <thead>
          <tr>
            <th>Token type</th>
            <th>Cost / 1M</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.id}>
              <td>
                <Controller
                  name={`${namePrefix}.${index}.name`}
                  control={control}
                  render={({
                    fieldState: { invalid, error },
                    field: controllerField,
                  }) => (
                    <ModelTokenTypeComboBox
                      options={tokenTypeOptions}
                      {...controllerField}
                      invalid={invalid}
                      isRequired
                      error={error?.message}
                    />
                  )}
                />
              </td>
              <td>
                <Controller
                  name={`${namePrefix}.${index}.cost`}
                  control={control}
                  render={({
                    fieldState: { invalid, error },
                    field: controllerField,
                  }) => (
                    <NumberField
                      isInvalid={invalid}
                      {...controllerField}
                      step={0.000001}
                      isRequired
                      minValue={0}
                      size="S"
                      formatOptions={{
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 6,
                      }}
                    >
                      <Input />
                      {error?.message && (
                        <FieldError>{error.message}</FieldError>
                      )}
                    </NumberField>
                  )}
                />
              </td>
              <td>
                <Button
                  leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
                  onPress={() => {
                    onRemove(index);
                  }}
                  size="S"
                  isDisabled={index === 0}
                />
              </td>
            </tr>
          ))}
          <tr>
            <td />
            <td>
              <Flex justifyContent="end">
                <Button
                  onPress={() => {
                    onAppend({
                      kind: appendKind,
                      name: "",
                      cost: 0,
                    });
                  }}
                  size="S"
                  variant="quiet"
                >
                  Add row
                </Button>
              </Flex>
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </>
  );
}
