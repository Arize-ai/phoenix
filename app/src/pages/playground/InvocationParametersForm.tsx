import React, { useCallback, useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Slider, Switch, TextField } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { Mutable } from "@phoenix/typeUtils";

import {
  InvocationParametersFormQuery,
  InvocationParametersFormQuery$data,
} from "./__generated__/InvocationParametersFormQuery.graphql";
import { InvocationParameterInput } from "./__generated__/PlaygroundOutputSubscription.graphql";
import { constrainInvocationParameterInputsToDefinition } from "./playgroundUtils";

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
const InvocationParameterFormField = ({
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
      return (
        <Switch onChange={onChange} defaultSelected={Boolean(value)}>
          {field.label}
        </Switch>
      );
    default:
      return null;
  }
};

const toCamelCase = (str: string) =>
  str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

const getInvocationParameterValue = (
  field: InvocationParameter,
  parameterInput: InvocationParameterInput
): string | number | string[] | boolean | null | undefined => {
  if (field.invocationInputField === undefined) {
    throw new Error("Invocation input field is required");
  }
  return parameterInput[
    toCamelCase(field.invocationInputField) as keyof InvocationParameterInput
  ];
};

const makeInvocationParameterInput = (
  field: InvocationParameter,
  value: string | number | string[] | boolean | undefined
): InvocationParameterInput | null => {
  if (field.invocationName === undefined) {
    throw new Error("Invocation name is required");
  }
  if (field.invocationInputField === undefined) {
    throw new Error("Invocation input field is required");
  }
  return {
    invocationName: field.invocationName,
    canonicalName: field.canonicalName,
    [toCamelCase(field.invocationInputField)]: value,
  };
};

type InvocationParametersFormProps = {
  instanceId: number;
};

export const InvocationParametersForm = ({
  instanceId,
}: InvocationParametersFormProps) => {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((i) => i.id === instanceId)
  );
  if (!instance) {
    throw new Error("Instance not found");
  }
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
              canonicalName
            }
            ... on BoundedFloatInvocationParameter {
              minValue
              maxValue
              invocationInputField
              # defaultValueFloat: defaultValue
            }
            ... on IntInvocationParameter {
              invocationInputField
              # defaultValueInt: defaultValue
            }
            ... on StringInvocationParameter {
              invocationInputField
              # defaultValueString: defaultValue
            }
            ... on StringListInvocationParameter {
              invocationInputField
              # defaultValueStringList: defaultValue
            }
            ... on BooleanInvocationParameter {
              invocationInputField
              # defaultValueBool: defaultValue
            }
          }
        }
      `,
      { input: { providerKey: model.provider, modelName: model.modelName } }
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
        filter: constrainInvocationParameterInputsToDefinition,
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
        const input = makeInvocationParameterInput(field, value);
        if (input) {
          updateInstanceModelInvocationParameters({
            instanceId: instance.id,
            invocationParameters: instance.model.invocationParameters.map(
              (p) => (p.invocationName === field.invocationName ? input : p)
            ),
          });
        }
      } else {
        const input = makeInvocationParameterInput(field, value);
        if (input) {
          updateInstanceModelInvocationParameters({
            instanceId: instance.id,
            invocationParameters: [
              ...instance.model.invocationParameters,
              input,
            ],
          });
        }
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
      <InvocationParameterFormField
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
