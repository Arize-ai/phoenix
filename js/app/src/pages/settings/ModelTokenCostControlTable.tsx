import { css } from "@emotion/react";
import { useEffect, useRef } from "react";
import type {
  Control,
  UseFormGetFieldState,
  UseFormTrigger,
} from "react-hook-form";
import { Controller } from "react-hook-form";

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
import type { ModelFormParams } from "@phoenix/pages/settings/ModelForm";
import type { ModelTokenKind } from "@phoenix/pages/settings/ModelTokenTypeComboBox";
import {
  ModelTokenTypeComboBox,
  normalizeTokenType,
} from "@phoenix/pages/settings/ModelTokenTypeComboBox";

const DUPLICATE_TOKEN_TYPE_ERROR = "Duplicate token type";

export function ModelTokenCostControlTable({
  title,
  namePrefix,
  fields,
  control,
  getFieldState,
  trigger,
  tokenTypeOptions,
  onAppend,
  onRemove,
  appendKind,
}: {
  title: string;
  namePrefix: "promptCosts" | "completionCosts";
  fields: { id: string }[];
  control: Control<ModelFormParams>;
  getFieldState: UseFormGetFieldState<ModelFormParams>;
  trigger: UseFormTrigger<ModelFormParams>;
  tokenTypeOptions: { tokenType: string; kind: ModelTokenKind }[];
  onAppend: (obj: {
    kind: ModelTokenKind;
    tokenType: string;
    costPerMillionTokens: number;
  }) => void;
  onRemove: (index: number) => void;
  appendKind: ModelTokenKind;
}) {
  // Editing or removing a row can resolve another row's duplicate error, but
  // react-hook-form only re-validates the field that changed. Only rows already
  // flagged are re-validated, so untouched empty rows do not start showing
  // "required" errors.
  const revalidateDuplicateRows = () => {
    const flaggedRows = fields
      .map((_, index) => `${namePrefix}.${index}.tokenType` as const)
      .filter(
        (name) =>
          getFieldState(name).error?.message === DUPLICATE_TOKEN_TYPE_ERROR
      );
    if (flaggedRows.length > 0) {
      void trigger(flaggedRows);
    }
  };

  // Removing a row shifts errors onto rows that did not change, and those
  // fields only re-register under their new names after the next render, so
  // re-validation is deferred to an effect. The ref gate keeps the effect from
  // re-triggering on every render while an error persists.
  const revalidateAfterRenderRef = useRef(false);
  useEffect(() => {
    if (!revalidateAfterRenderRef.current) {
      return;
    }
    revalidateAfterRenderRef.current = false;
    revalidateDuplicateRows();
  });
  return (
    <>
      <Heading level={3} weight="heavy">
        {title}
      </Heading>

      <table
        css={css`
          border-collapse: separate;
          border-spacing: 0 var(--global-dimension-size-100);
          width: 100%;

          & th {
            text-align: left;
            font-weight: normal;
            color: var(--global-color-gray-500);
          }

          & th:not(:last-child) {
            padding-right: var(--global-dimension-size-100);
          }

          & td {
            vertical-align: top;
          }

          & tbody td:not(:last-child) {
            padding-right: var(--global-dimension-size-100);
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
                    validate: (value, formValues) => {
                      const tokenType = normalizeTokenType(value ?? "");
                      if (!tokenType) {
                        return "Token type is required";
                      }
                      const isDuplicate = formValues[namePrefix]
                        .slice(0, index)
                        .some(
                          (cost) =>
                            normalizeTokenType(
                              cost.tokenType ?? ""
                            ).toLowerCase() === tokenType.toLowerCase()
                        );
                      return !isDuplicate || DUPLICATE_TOKEN_TYPE_ERROR;
                    },
                  }}
                  render={({
                    fieldState: { invalid, error },
                    field: controllerField,
                  }) => (
                    <ModelTokenTypeComboBox
                      options={tokenTypeOptions}
                      {...controllerField}
                      onChange={(tokenType) => {
                        controllerField.onChange(tokenType);
                        revalidateDuplicateRows();
                      }}
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
                  leadingVisual={<Icon svg={<Icons.Trash />} />}
                  onPress={() => {
                    onRemove(index);
                    revalidateAfterRenderRef.current = true;
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
