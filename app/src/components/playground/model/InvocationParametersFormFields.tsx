import { debounce } from "lodash";
import { useCallback, useEffect, useMemo } from "react";
import type { Control, FieldErrors } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";

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
import { OpenAIReasoningEffortConfigField } from "@phoenix/components/playground/model/OpenAIReasoningEffortConfigField";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { AnthropicReasoningConfigField } from "@phoenix/pages/playground/AnthropicReasoningConfigField";
import { GoogleGenAIThinkingLevelConfigField } from "@phoenix/pages/playground/GoogleGenAIThinkingLevelConfigField";
import type { ParamSpec } from "@phoenix/pages/playground/invocationParameterSpecs";
import {
  getActiveSpecsForPlayground,
  invocationValueKeyForSpec,
} from "@phoenix/pages/playground/invocationParameterSpecs";
import type { ModelInvocationParameterInput } from "@phoenix/store";

import { areInvocationParamsEqual } from "../../../pages/playground/invocationParameterUtils";
import { InvocationParameterJsonEditor } from "./InvocationParameterJsonEditor";

/**
 * Form field for a single invocation parameter driven by the static frontend
 * {@link ParamSpec} table.
 */
const InvocationParameterFormField = ({
  spec,
  value,
  onChange,
  errors,
  control,
}: {
  spec: ParamSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  errors: FieldErrors<Record<string, unknown>>;
  control: Control<Record<string, unknown>>;
}) => {
  const errorMessage = errors[spec.name]?.message;
  const requiredRuleMessage = spec.required
    ? `${spec.label || spec.name} is required`
    : undefined;
  const numericMin =
    spec.type === "int" ||
    spec.type === "float" ||
    spec.type === "bounded_float"
      ? spec.min
      : undefined;
  const numericMax =
    spec.type === "int" ||
    spec.type === "float" ||
    spec.type === "bounded_float"
      ? spec.max
      : undefined;
  const minRuleMessage =
    numericMin != null
      ? `${spec.label || spec.name} must be at least ${numericMin}`
      : undefined;
  const maxRuleMessage =
    numericMax != null
      ? `${spec.label || spec.name} must be at most ${numericMax}`
      : undefined;

  if (spec.ui === "anthropic_thinking") {
    return <AnthropicReasoningConfigField onChange={onChange} value={value} />;
  }
  if (spec.canonicalName === "REASONING_EFFORT") {
    if (spec.name === "thinking_level") {
      return (
        <GoogleGenAIThinkingLevelConfigField
          onChange={onChange}
          value={value ?? null}
          label={spec.label}
        />
      );
    }
    return (
      <OpenAIReasoningEffortConfigField
        onChange={onChange}
        value={value ?? null}
        label={spec.label}
      />
    );
  }

  switch (spec.type) {
    case "bounded_float": {
      const isNumber = typeof value === "number";
      const defaultValue = isNumber ? value : undefined;
      return (
        <Slider
          label={spec.label}
          defaultValue={defaultValue}
          step={0.1}
          minValue={numericMin}
          maxValue={numericMax}
          onChange={(next) => {
            if (Array.isArray(next) && next.length > 0) {
              return onChange(next[0]);
            }
            onChange(next);
          }}
        >
          <SliderNumberField defaultValue={defaultValue} />
        </Slider>
      );
    }
    case "float":
    case "int":
      return (
        <Controller
          control={control}
          name={spec.name}
          rules={{
            required: requiredRuleMessage,
            min: minRuleMessage,
            max: maxRuleMessage,
          }}
          render={({ field: { onBlur } }) => (
            <NumberField
              isRequired={spec.required}
              value={Number(value)}
              onBlur={onBlur}
              onChange={(next) => onChange(next)}
            >
              <Label>{spec.label}</Label>
              <Input />
              {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
            </NumberField>
          )}
        />
      );
    case "string_list":
      if (!Array.isArray(value) && value !== undefined) return null;
      return (
        <Controller
          control={control}
          name={spec.name}
          rules={{ required: requiredRuleMessage }}
          render={({ field: { onBlur } }) => (
            <TextField
              isRequired={spec.required}
              defaultValue={value?.join(", ") ?? ""}
              onBlur={onBlur}
              onChange={(next) => {
                if (next === "") {
                  onChange(undefined);
                  return;
                }
                onChange(next.split(/, */g));
              }}
            >
              <Label>{spec.label}</Label>
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
    case "string":
    case "enum":
      return (
        <Controller
          control={control}
          name={spec.name}
          rules={{ required: requiredRuleMessage }}
          render={({ field: { onBlur } }) => (
            <TextField
              isRequired={spec.required}
              defaultValue={value?.toString() || ""}
              type="text"
              onBlur={onBlur}
              onChange={(next) => {
                if (next === "") {
                  onChange(undefined);
                  return;
                }
                onChange(next);
              }}
            >
              <Label>{spec.label}</Label>
              <Input />
              {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
            </TextField>
          )}
        />
      );
    case "bool":
      return (
        <Switch onChange={onChange} defaultSelected={Boolean(value)}>
          {spec.label}
        </Switch>
      );
    case "json":
      return (
        <Controller
          control={control}
          name={spec.name}
          rules={{ required: requiredRuleMessage }}
          render={() => (
            <InvocationParameterJsonEditor
              defaultValue={value}
              onChange={onChange}
              label={spec.label || spec.name}
              errorMessage={errorMessage}
            />
          )}
        />
      );
    default:
      return null;
  }
};

const getInvocationParameterValue = (
  spec: ParamSpec,
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
  const field = invocationValueKeyForSpec(spec);
  return parameterInput[field];
};

const makeInvocationParameterInput = (
  spec: ParamSpec,
  value: unknown
): ModelInvocationParameterInput => {
  const field = invocationValueKeyForSpec(spec);
  return {
    invocationName: spec.name,
    canonicalName: spec.canonicalName,
    [field]: value,
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

  const specs = useMemo(() => getActiveSpecsForPlayground(model), [model]);
  const instanceInvocationParameters = instance.model.invocationParameters;

  const onChange = useCallback(
    (spec: ParamSpec, value: unknown) => {
      if (value === undefined) {
        deleteInvocationParameterInput({
          instanceId,
          invocationParameterInputInvocationName: spec.name,
        });
      } else {
        upsertInvocationParameterInput({
          instanceId,
          invocationParameterInput: makeInvocationParameterInput(spec, value),
        });
      }
    },
    [instanceId, upsertInvocationParameterInput, deleteInvocationParameterInput]
  );

  const values = useMemo(() => {
    return specs.reduce(
      (acc, spec) => {
        const existingParameter = instanceInvocationParameters.find((p) =>
          areInvocationParamsEqual(p, spec)
        );
        const value = existingParameter
          ? getInvocationParameterValue(spec, existingParameter)
          : undefined;
        acc[spec.name] = value ?? null;
        return acc;
      },
      {} as Record<string, unknown>
    );
  }, [instanceInvocationParameters, specs]);

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
    debouncedTrigger();
  }, [values, debouncedTrigger]);

  if (model.provider !== "AZURE_OPENAI" && model.modelName === null) {
    return null;
  }

  return specs.map((spec) => {
    const key = `${model.provider ?? "model"}-${spec.name}`;
    return (
      <InvocationParameterFormField
        key={key}
        spec={spec}
        value={values[spec.name]}
        onChange={(next) => onChange(spec, next)}
        control={form.control}
        errors={form.formState.errors}
      />
    );
  });
};
