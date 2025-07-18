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
import {
  ModelTokenKind,
  ModelTokenTypeComboBox,
} from "@phoenix/pages/settings/ModelTokenTypeComboBox";

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
  tokenTypeOptions: { tokenType: string; kind: ModelTokenKind }[];
  onAppend: (obj: {
    kind: ModelTokenKind;
    tokenType: string;
    costPerMillionTokens: number;
  }) => void;
  onRemove: (index: number) => void;
  appendKind: ModelTokenKind;
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
                  name={`${namePrefix}.${index}.tokenType`}
                  control={control}
                  rules={{
                    required: "Token type is required",
                  }}
                  render={({
                    fieldState: { invalid, error },
                    field: controllerField,
                  }) => (
                    <ModelTokenTypeComboBox
                      options={tokenTypeOptions}
                      {...controllerField}
                      invalid={invalid}
                      error={error?.message}
                    />
                  )}
                />
              </td>
              <td>
                <Controller
                  name={`${namePrefix}.${index}.costPerMillionTokens`}
                  control={control}
                  rules={{
                    required: "Cost per 1M tokens is required",
                  }}
                  render={({ fieldState: { invalid, error }, field }) => (
                    <NumberField
                      {...field}
                      isInvalid={invalid}
                      minValue={0}
                      isRequired
                      size="S"
                      formatOptions={{
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
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
              <Flex justifyContent="end" alignItems="start">
                <Button
                  onPress={() => {
                    onAppend({
                      kind: appendKind,
                      tokenType: "",
                      costPerMillionTokens: 0,
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
