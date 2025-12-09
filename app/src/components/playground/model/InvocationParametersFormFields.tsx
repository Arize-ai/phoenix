import { useCallback, useEffect, useMemo } from "react";
import { Control, Controller, FieldErrors, useForm } from "react-hook-form";
import { debounce } from "lodash";

import {
  FieldError,
  Input,
  Label,
  NumberField,
  Slider,
  SliderNumberField,
  Switch,
  Text,
  TextField,
} from "@phoenix/components";
import { ModelSupportedParamsFetcherQuery$data } from "@phoenix/components/playground/model/__generated__/ModelSupportedParamsFetcherQuery.graphql";
import { OpenAIReasoningEffortConfigField } from "@phoenix/components/playground/model/OpenAIReasoningEffortConfigField";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { AnthropicReasoningConfigField } from "@phoenix/pages/playground/AnthropicReasoningConfigField";
import { ModelInvocationParameterInput } from "@phoenix/store";
import { Mutable } from "@phoenix/typeUtils";

import { paramsToIgnoreInInvocationParametersForm } from "../../../pages/playground/constants";
import {
  areInvocationParamsEqual,
  toCamelCase,
} from "../../../pages/playground/playgroundUtils";

import { InvocationParameterJsonEditor } from "./InvocationParameterJsonEditor";

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
  const requiredRuleMessage = field.required
    ? `${field.label || invocationName} is required`
    : undefined;
  const minRuleMessage =
    field.minValue != null
      ? `${field.label || invocationName} must be at least ${field.minValue}`
      : undefined;
  const maxRuleMessage =
    field.maxValue != null
      ? `${field.label || invocationName} must be at most ${field.maxValue}`
      : undefined;

  // special case for anthropic reasoning config
  if (field.canonicalName === "ANTHROPIC_EXTENDED_THINKING") {
    return <AnthropicReasoningConfigField onChange={onChange} value={value} />;
  }

  // special case for openai reasoning effort
  if (field.canonicalName === "REASONING_EFFORT") {
    return (
      <OpenAIReasoningEffortConfigField
        onChange={onChange}
        value={value ?? null}
        label={field.label ?? undefined}
      />
    );
  }

  const { __typename } = field;
  switch (__typename) {
    case "InvocationParameterBase":
      return null;
    case "BoundedFloatInvocationParameter": {
      const isNumber = typeof value === "number";
      const defaultValue = isNumber ? value : undefined;
      return (
        <Slider
          label={field.label}
          defaultValue={defaultValue}
          step={0.1}
          minValue={field.minValue}
          maxValue={field.maxValue}
          onChange={(value) => {
            // NB: the type inference here is wrong. In the case
            // that the defaultValue is undefined, an array is returned here
            if (Array.isArray(value) && value.length > 0) {
              return onChange(value[0]);
            }
            onChange(value);
          }}
        >
          <SliderNumberField defaultValue={defaultValue} />
        </Slider>
      );
    }
    case "FloatInvocationParameter":
    case "IntInvocationParameter":
      return (
        <Controller
          control={control}
          name={invocationName}
          rules={{
            required: requiredRuleMessage,
            min: minRuleMessage,
            max: maxRuleMessage,
          }}
          render={({ field: { onBlur } }) => (
            <NumberField
              isRequired={field.required}
              value={Number(value)}
              onBlur={onBlur}
              onChange={(value) => {
                onChange(value);
              }}
            >
              <Label>{field.label}</Label>
              <Input />
              {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
            </NumberField>
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
            required: requiredRuleMessage,
          }}
          render={({ field: { onBlur } }) => (
            <TextField
              isRequired={field.required}
              defaultValue={value?.join(", ") ?? ""}
              onBlur={onBlur}
              onChange={(value) => {
                if (value === "") {
                  onChange(undefined);
                  return;
                }
                onChange(value.split(/, */g));
              }}
            >
              <Label>{field.label}</Label>
              <Input />
              {errorMessage ? (
                <FieldError>{errorMessage}</FieldError>
              ) : (
                <Text slot="description">
                  A comma separated list of strings
                </Text>
              )}
            </TextField>
          )}
        />
      );
    case "StringInvocationParameter":
      return (
        <Controller
          control={control}
          name={invocationName}
          rules={{
            required: requiredRuleMessage,
          }}
          render={({ field: { onBlur } }) => (
            <TextField
              isRequired={field.required}
              defaultValue={value?.toString() || ""}
              type="text"
              onBlur={onBlur}
              onChange={(value) => {
                if (value === "") {
                  onChange(undefined);
                  return;
                }
                onChange(value);
              }}
            >
              <Label>{field.label}</Label>
              <Input />
              {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
            </TextField>
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
            required: requiredRuleMessage,
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
  parameterInput: ModelInvocationParameterInput
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
      toCamelCase(
        field.invocationInputField
      ) as keyof ModelInvocationParameterInput
    ];
  return maybeValue;
};

const makeInvocationParameterInput = (
  field: InvocationParameter,
  value: unknown
): ModelInvocationParameterInput => {
  if (field.invocationName === undefined) {
    throw new Error("Invocation name is required");
  }
  if (field.invocationInputField === undefined) {
    throw new Error("Invocation input field is required");
  }
  return {
    invocationName: field.invocationName,
    canonicalName: field.canonicalName,
    dirty: true,
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
      .reduce(
        (acc, field) => {
          const existingParameter = instanceInvocationParameters.find((p) =>
            areInvocationParamsEqual(p, field)
          );
          const value = existingParameter
            ? getInvocationParameterValue(field, existingParameter)
            : undefined;
          return {
            ...acc,
            [field.invocationName!]: value ?? null,
          };
        },
        {} as Record<string, unknown>
      );
  }, [instanceInvocationParameters, supportedInvocationParameterDefinitions]);

  // Mirror the form state in react-hook-form so that we can use the validation and error state
  const form = useForm({
    values,
    mode: "onBlur",
    delayError: 0,
    shouldFocusError: false,
    resetOptions: {
      keepErrors: true,
    },
  });

  const trigger = form.trigger;
  const debouncedTrigger = useMemo(() => debounce(trigger, 250), [trigger]);

  useEffect(() => {
    // revalidate the form when the values change
    // debounce to trigger validation only after the user has stopped typing
    debouncedTrigger();
  }, [values, debouncedTrigger]);

  // Don't bother rendering the form if the model name is not set
  // Except for Azure OpenAI, where the model name does not influence the invocation parameters
  if (model.provider !== "AZURE_OPENAI" && model.modelName === null) {
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

      // Remount the field when the provider changes so that we don't hang on to stale values
      const key = `${model.provider ?? "model"}-${field.invocationName}`;

      return (
        <InvocationParameterFormField
          key={key}
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
