import React, { useCallback, useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Slider, TextField } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundInstance } from "@phoenix/store";
import { Mutable } from "@phoenix/typeUtils";

import {
  InvocationParametersFormQuery,
  InvocationParametersFormQuery$data,
} from "./__generated__/InvocationParametersFormQuery.graphql";
import { InvocationParameterInput } from "./__generated__/PlaygroundOutputSubscription.graphql";

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

const getInvocationParameterValue = (
  field: InvocationParameter,
  parameterInput: InvocationParameterInput
): string | number | string[] | boolean | null | undefined => {
  const type = field.__typename;
  switch (type) {
    case "FloatInvocationParameter":
    case "BoundedFloatInvocationParameter":
      return parameterInput.valueFloat;
    case "IntInvocationParameter":
      return parameterInput.valueInt;
    case "StringInvocationParameter":
      return parameterInput.valueString;
    case "StringListInvocationParameter":
      return parameterInput.valueStringList as string[] | undefined | null;
    case "BooleanInvocationParameter":
      return parameterInput.valueBool;
    default:
      throw new Error(`Unsupported invocation parameter type: ${type}`);
  }
};

const makeInvocationParameterInput = (
  field: InvocationParameter,
  value: string | number | string[] | boolean | undefined
): InvocationParameterInput => {
  if (field.invocationName === undefined) {
    throw new Error("Invocation name is required");
  }
  const type = field.__typename;
  switch (type) {
    case "FloatInvocationParameter":
    case "BoundedFloatInvocationParameter":
      return {
        invocationName: field.invocationName,
        valueFloat: value === undefined ? undefined : Number(value),
      };
    case "IntInvocationParameter":
      return {
        invocationName: field.invocationName,
        valueInt: value === undefined ? undefined : Number(value),
      };
    case "StringInvocationParameter":
      return {
        invocationName: field.invocationName,
        valueString: value === undefined ? undefined : String(value),
      };
    case "StringListInvocationParameter":
      return {
        invocationName: field.invocationName,
        valueStringList: Array.isArray(value) ? value : undefined,
      };
    case "BooleanInvocationParameter":
      return {
        invocationName: field.invocationName,
        valueBool: value === undefined ? undefined : Boolean(value),
      };
    default:
      throw new Error(`Unsupported invocation parameter type: ${type}`);
  }
};

type InvocationParametersFormProps = {
  instance: PlaygroundInstance;
};

export const InvocationParametersForm = ({
  instance,
}: InvocationParametersFormProps) => {
  const { model } = instance;
  const updateInstanceModelInvocationParameters = usePlaygroundContext(
    (state) => state.updateInstanceModelInvocationParameters
  );
  const filterInstanceModelInvocationParameters = usePlaygroundContext(
    (state) => state.filterInstanceModelInvocationParameters
  );
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

  useEffect(() => {
    // filter invocation parameters to only include those that are supported by the model
    if (modelInvocationParameters) {
      filterInstanceModelInvocationParameters({
        instanceId: instance.id,
        modelSupportedInvocationParameters:
          modelInvocationParameters as Mutable<
            typeof modelInvocationParameters
          >,
      });
    }
  }, [
    filterInstanceModelInvocationParameters,
    instance.id,
    modelInvocationParameters,
  ]);

  const onChange = useCallback(
    (
      field: InvocationParameter,
      value: string | number | string[] | boolean | undefined
    ) => {
      const existingParameter = instance.model.invocationParameters.find(
        (p) => p.invocationName === field.invocationName
      );

      if (existingParameter) {
        updateInstanceModelInvocationParameters({
          instanceId: instance.id,
          invocationParameters: instance.model.invocationParameters.map((p) =>
            p.invocationName === field.invocationName
              ? makeInvocationParameterInput(field, value)
              : p
          ),
        });
      } else {
        updateInstanceModelInvocationParameters({
          instanceId: instance.id,
          invocationParameters: [
            ...instance.model.invocationParameters,
            makeInvocationParameterInput(field, value),
          ],
        });
      }
    },
    [instance, updateInstanceModelInvocationParameters]
  );

  const fieldsForSchema = modelInvocationParameters.map((field) => {
    const existingParameter = instance.model.invocationParameters.find(
      (p) => p.invocationName === field.invocationName
    );
    const value = existingParameter
      ? getInvocationParameterValue(field, existingParameter)
      : undefined;
    return (
      <FormField
        key={field.invocationName}
        field={field}
        value={value === null ? undefined : value}
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
