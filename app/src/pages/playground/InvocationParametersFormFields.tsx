import React, { useCallback, useLayoutEffect, useMemo } from "react";
import { Control, Controller, FieldErrors, useForm } from "react-hook-form";

import { Slider, Switch, TextField } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { Mutable } from "@phoenix/typeUtils";

import { ModelSupportedParamsFetcherQuery$data } from "./__generated__/ModelSupportedParamsFetcherQuery.graphql";
import { InvocationParameterInput } from "./__generated__/PlaygroundOutputSubscription.graphql";
import { paramsToIgnoreInInvocationParametersForm } from "./constants";
import { InvocationParameterJsonEditor } from "./InvocationParameterJsonEditor";
import { areInvocationParamsEqual, toCamelCase } from "./playgroundUtils";

export type InvocationParameter = Mutable<
  ModelSupportedParamsFetcherQuery$data["modelInvocationParameters"]
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
  errors,
  control,
}: {
  field: InvocationParameter;
  value: unknown;
  onChange: (value: unknown) => void;
  errors: FieldErrors<Record<string, unknown>>;
  control: Control<Record<string, unknown>>;
}) => {
  const invocationName = field.invocationName;
  if (!invocationName) {
    throw new Error("Invocation name is required");
  }
  const errorMessage = errors[invocationName]?.message;
  const required = field.required
    ? `${field.label || invocationName} is required`
    : undefined;
  const min = field.minValue
    ? `${field.label || invocationName} must be at least ${field.minValue}`
    : undefined;
  const max = field.maxValue
    ? `${field.label || invocationName} must be at most ${field.maxValue}`
    : undefined;
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
          defaultValue={value}
          step={0.1}
          minValue={field.minValue}
          maxValue={field.maxValue}
          onChange={(value) => onChange(value)}
        />
      );
    case "FloatInvocationParameter":
    case "IntInvocationParameter":
      return (
        <Controller
          control={control}
          name={invocationName}
          rules={{
            required,
            min,
            max,
          }}
          render={({ field: { onBlur } }) => (
            <TextField
              label={field.label}
              isRequired={field.required}
              defaultValue={value?.toString() || ""}
              type="number"
              onBlur={onBlur}
              onChange={(value) => {
                if (value === "") {
                  onChange(undefined);
                  return;
                }
                onChange(Number(value));
              }}
              errorMessage={errorMessage}
              validationState={errorMessage ? "invalid" : "valid"}
            />
          )}
        />
      );
    case "StringListInvocationParameter":
      if (!Array.isArray(value) && value !== undefined) return null;
      return (
        <Controller
          control={control}
          name={invocationName}
          rules={{
            required,
          }}
          render={() => (
            <TextField
              label={field.label}
              isRequired={field.required}
              defaultValue={value?.join(", ") ?? ""}
              onChange={(value) => {
                if (value === "") {
                  onChange(undefined);
                  return;
                }
                onChange(value.split(/, */g));
              }}
              description={"A comma separated list of strings"}
              errorMessage={errorMessage}
            />
          )}
        />
      );
    case "StringInvocationParameter":
      return (
        <Controller
          control={control}
          name={invocationName}
          rules={{
            required,
          }}
          render={() => (
            <TextField
              label={field.label}
              isRequired={field.required}
              defaultValue={value?.toString() || ""}
              type="text"
              onChange={(value) => {
                if (value === "") {
                  onChange(undefined);
                  return;
                }
                onChange(value);
              }}
              errorMessage={errorMessage}
            />
          )}
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
        <Controller
          control={control}
          name={invocationName}
          rules={{
            required,
          }}
          render={() => (
            <InvocationParameterJsonEditor
              defaultValue={value}
              onChange={onChange}
              label={field.label ?? field.invocationName ?? ""}
              errorMessage={errorMessage}
            />
          )}
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
  return maybeValue;
};

const makeInvocationParameterInput = (
  field: InvocationParameter,
  value: unknown
): InvocationParameterInput => {
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
  const upsertInvocationParameterInput = usePlaygroundContext(
    (state) => state.upsertInvocationParameterInput
  );
  const deleteInvocationParameterInput = usePlaygroundContext(
    (state) => state.deleteInvocationParameterInput
  );

  const supportedInvocationParameterDefinitions =
    instance.model.supportedInvocationParameters;
  const instanceInvocationParameters = instance.model.invocationParameters;

  // Handle changes to the form state, either deleting or upserting an invocation parameter
  const onChange = useCallback(
    (field: InvocationParameter, value: unknown) => {
      if (!field.invocationName) {
        throw new Error("Invocation name is required");
      }
      if (value === undefined) {
        deleteInvocationParameterInput({
          instanceId,
          invocationParameterInputInvocationName: field.invocationName,
        });
      } else {
        upsertInvocationParameterInput({
          instanceId,
          invocationParameterInput: makeInvocationParameterInput(field, value),
        });
      }
    },
    [instanceId, upsertInvocationParameterInput, deleteInvocationParameterInput]
  );

  // Reduce our invocation parameters array into a form state object
  const values = useMemo(() => {
    return supportedInvocationParameterDefinitions
      .filter(
        (field) =>
          // remove parameters that we want to ignore in the form
          !(
            field.canonicalName != null &&
            paramsToIgnoreInInvocationParametersForm.includes(
              field.canonicalName
            )
          )
      )
      .map((field) => {
        const existingParameter = instanceInvocationParameters.find((p) =>
          areInvocationParamsEqual(p, field)
        );
        const value = existingParameter
          ? getInvocationParameterValue(field, existingParameter)
          : undefined;
        return {
          [field.invocationName!]: value ?? null,
        };
      })
      .reduce(
        (acc, param) => {
          return { ...acc, ...param };
        },
        {} as Record<string, unknown>
      );
  }, [instanceInvocationParameters, supportedInvocationParameterDefinitions]);

  // Mirror the form state in react-hook-form so that we can use the validation and error state
  const form = useForm({
    values,
    mode: "onBlur",
  });

  // Trigger validation on mount, but after the initial render commits and controls have been
  // attached in fieldsForSchema
  useLayoutEffect(() => {
    form.trigger();
  }, [form]);

  // Don't bother rendering the form if the model name is not set
  if (model.modelName === null) {
    return null;
  }

  const fieldsForSchema = Object.entries(values).map(
    ([invocationName, value]) => {
      const field = supportedInvocationParameterDefinitions.find(
        (p) => p.invocationName === invocationName
      );

      if (!field) {
        return null;
      }

      return (
        <InvocationParameterFormField
          key={field.invocationName}
          field={field}
          value={value}
          onChange={(value) => onChange(field, value)}
          control={form.control}
          errors={form.formState.errors}
        />
      );
    }
  );

  return fieldsForSchema;
};
