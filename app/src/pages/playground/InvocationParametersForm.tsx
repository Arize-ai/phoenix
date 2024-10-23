import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Slider, TextField } from "@arizeai/components";

import { ModelConfig } from "@phoenix/store";
import { Mutable } from "@phoenix/typeUtils";

import {
  InvocationParametersFormQuery,
  InvocationParametersFormQuery$data,
} from "./__generated__/InvocationParametersFormQuery.graphql";

export type InvocationParameter = Mutable<
  InvocationParametersFormQuery$data["modelInvocationParameters"]
>[number];

export type HandleInvocationParameterChange = (
  parameter: InvocationParameter,
  value: string | number | string[] | boolean | undefined
) => void;

/**
 * Form field for a single invocation parameter.
 */
const FormField = ({
  field,
  value,
  onChange,
}: {
  field: InvocationParameter;
  value: string | number | string[] | boolean | undefined;
  onChange: (value: string | number | string[] | boolean | undefined) => void;
}) => {
  const { __typename } = field;
  switch (__typename) {
    case "InvocationParameterBase":
      return null;
    case "FloatInvocationParameter":
    case "BoundedFloatInvocationParameter":
      if (typeof value !== "number" && value !== undefined) return null;
      return (
        <Slider
          label={field.label}
          isRequired={field.required}
          value={value}
          step={0.1}
          minValue={field.minValue}
          maxValue={field.maxValue}
          onChange={(value) => onChange(value)}
        />
      );
    case "IntInvocationParameter":
      return (
        <TextField
          label={field.label}
          isRequired={field.required}
          value={value?.toString() || ""}
          type="number"
          onChange={(value) => onChange(Number(value))}
        />
      );
    case "StringListInvocationParameter":
      if (!Array.isArray(value) && value !== undefined) return null;
      return (
        <TextField
          label={field.label}
          isRequired={field.required}
          defaultValue={value?.join(", ") || ""}
          onChange={(value) => onChange(value.split(/, */g))}
        />
      );
    case "StringInvocationParameter":
      return (
        <TextField
          label={field.label}
          isRequired={field.required}
          value={value?.toString() || ""}
          type="text"
          onChange={(value) => onChange(value)}
        />
      );
    case "BooleanInvocationParameter":
      // TODO: add checkbox
      return null;
    default:
      return null;
  }
};

type InvocationParametersFormProps = {
  model: ModelConfig;
  onChange: HandleInvocationParameterChange;
};

export const InvocationParametersForm = ({
  model,
  onChange,
}: InvocationParametersFormProps) => {
  const { modelInvocationParameters } =
    useLazyLoadQuery<InvocationParametersFormQuery>(
      graphql`
        query InvocationParametersFormQuery($input: ModelsInput!) {
          modelInvocationParameters(input: $input) {
            __typename
            ... on InvocationParameterBase {
              invocationName
              label
              required
            }
            ... on BoundedFloatInvocationParameter {
              minValue
              maxValue
            }
          }
        }
      `,
      { input: { providerKey: model.provider } }
    );

  const fieldsForSchema = modelInvocationParameters.map((field) => {
    return (
      <FormField
        key={field.invocationName}
        field={field}
        value={undefined}
        onChange={(value) => onChange(field, value)}
      />
    );
  });
  return (
    <Flex direction="column" gap="size-200">
      {fieldsForSchema}
    </Flex>
  );
};
