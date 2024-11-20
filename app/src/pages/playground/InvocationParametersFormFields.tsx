import React, { useCallback, useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Slider, Switch, TextField } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { Mutable } from "@phoenix/typeUtils";

import {
  InvocationParametersFormFieldsQuery,
  InvocationParametersFormFieldsQuery$data,
} from "./__generated__/InvocationParametersFormFieldsQuery.graphql";
import { InvocationParameterInput } from "./__generated__/PlaygroundOutputSubscription.graphql";
import { paramsToIgnoreInInvocationParametersForm } from "./constants";
import { InvocationParameterJsonEditor } from "./InvocationParameterJsonEditor";
import {
  areInvocationParamsEqual,
  constrainInvocationParameterInputsToDefinition,
  toCamelCase,
} from "./playgroundUtils";

export type InvocationParameter = Mutable<
  InvocationParametersFormFieldsQuery$data["modelInvocationParameters"]
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
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const { __typename } = field;
  switch (__typename) {
    case "InvocationParameterBase":
      return null;
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
    case "FloatInvocationParameter":
    case "IntInvocationParameter":
      return (
        <TextField
          label={field.label}
          isRequired={field.required}
          value={value?.toString() || ""}
          type="number"
          onChange={(value) => {
            if (value === "") {
              onChange(undefined);
              return;
            }
            onChange(Number(value));
          }}
        />
      );
    case "StringListInvocationParameter":
      if (!Array.isArray(value) && value !== undefined) return null;
      return (
        <TextField
          label={field.label}
          isRequired={field.required}
          defaultValue={value?.join(", ")}
          onChange={(value) => {
            if (value === "") {
              onChange(undefined);
              return;
            }
            onChange(value.split(/, */g));
          }}
          description={"A comma separated list of strings"}
        />
      );
    case "StringInvocationParameter":
      return (
        <TextField
          label={field.label}
          isRequired={field.required}
          value={value?.toString() || ""}
          type="text"
          onChange={(value) => {
            if (value === "") {
              onChange(undefined);
              return;
            }
            onChange(value);
          }}
        />
      );
    case "BooleanInvocationParameter":
      return (
        <Switch onChange={onChange} defaultSelected={Boolean(value)}>
          {field.label}
        </Switch>
      );
    case "JSONInvocationParameter": {
      return (
        <InvocationParameterJsonEditor
          initialValue={value}
          onChange={onChange}
          label={field.label ?? field.invocationName ?? ""}
        />
      );
    }
    default:
      return null;
  }
};

const getInvocationParameterValue = (
  field: InvocationParameter,
  parameterInput: InvocationParameterInput
):
  | string
  | number
  | readonly string[]
  | boolean
  | null
  | Record<string, unknown>
  | unknown[]
  | undefined => {
  if (field.invocationInputField === undefined) {
    throw new Error("Invocation input field is required");
  }
  const maybeValue =
    parameterInput[
      toCamelCase(field.invocationInputField) as keyof InvocationParameterInput
    ];
  if (maybeValue != null) {
    return maybeValue;
  }
  switch (field.__typename) {
    case "InvocationParameterBase":
      return null;
    case "FloatInvocationParameter":
    case "BoundedFloatInvocationParameter":
      return field.floatDefaultValue;
    case "IntInvocationParameter":
      return field.intDefaultValue;
    case "StringListInvocationParameter":
      return field.stringListDefaultValue;
    case "StringInvocationParameter":
      return field.stringDefaultValue;
    case "BooleanInvocationParameter":
      return field.booleanDefaultValue;
    case "JSONInvocationParameter":
      return field.jsonDefaultValue;
    default: {
      return null;
    }
  }
};

const makeInvocationParameterInput = (
  field: InvocationParameter,
  value: unknown
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

export const InvocationParametersFormFields = ({
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
  /**
   * Azure openai has user defined model names but our invocation parameters query will never know
   * what they are. We will just pass in an empty model name and the query will fallback to the set
   * of invocation parameters that are defaults to our azure client.
   */
  const modelNameToQuery =
    model.provider !== "AZURE_OPENAI" ? model.modelName : null;
  const { modelInvocationParameters } =
    useLazyLoadQuery<InvocationParametersFormFieldsQuery>(
      graphql`
        query InvocationParametersFormFieldsQuery($input: ModelsInput!) {
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
              floatDefaultValue: defaultValue
            }
            ... on FloatInvocationParameter {
              invocationInputField
              floatDefaultValue: defaultValue
            }
            ... on IntInvocationParameter {
              invocationInputField
              intDefaultValue: defaultValue
            }
            ... on StringInvocationParameter {
              invocationInputField
              stringDefaultValue: defaultValue
            }
            ... on StringListInvocationParameter {
              invocationInputField
              stringListDefaultValue: defaultValue
            }
            ... on BooleanInvocationParameter {
              invocationInputField
              booleanDefaultValue: defaultValue
            }
            ... on JSONInvocationParameter {
              invocationInputField
              jsonDefaultValue: defaultValue
            }
          }
        }
      `,
      { input: { providerKey: model.provider, modelName: modelNameToQuery } }
    );

  const onChange = useCallback(
    (field: InvocationParameter, value: unknown) => {
      const existingParameter = instance.model.invocationParameters.find((p) =>
        areInvocationParamsEqual(p, field)
      );
      if (value === undefined) {
        if (existingParameter) {
          updateInstanceModelInvocationParameters({
            instanceId: instance.id,
            invocationParameters: instance.model.invocationParameters.filter(
              (p) => !areInvocationParamsEqual(p, field)
            ),
          });
        }
        return;
      }

      if (existingParameter) {
        const input = makeInvocationParameterInput(field, value);
        if (input) {
          updateInstanceModelInvocationParameters({
            instanceId: instance.id,
            invocationParameters: instance.model.invocationParameters.map(
              (p) => (areInvocationParamsEqual(p, field) ? input : p)
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

  useEffect(() => {
    // filter invocation parameters to only include those that are supported by the model
    // This will remove configured values that are not supported by the newly selected model
    // Including invocation parameters managed outside of this form, like response_format
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

  // It is safe to render this component if the model name is not set for non-azure models
  // Hooks will still run to filter invocation parameters to only include those supported by the model
  // but no form fields will be rendered if the model name is not set
  if (model.modelName === null && model.provider !== "AZURE_OPENAI") {
    return null;
  }

  const fieldsForSchema = modelInvocationParameters
    .filter(
      (field) =>
        !(
          field.canonicalName != null &&
          paramsToIgnoreInInvocationParametersForm.includes(field.canonicalName)
        )
    )
    .map((field) => {
      const existingParameter = instance.model.invocationParameters.find((p) =>
        areInvocationParamsEqual(p, field)
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

  return fieldsForSchema;
};
