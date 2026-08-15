import { debounce } from "lodash";
import { useCallback, useEffect, useMemo } from "react";
import type { Control, FieldErrors } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";

import {
  FieldError,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  SelectItem,
  SelectValue,
  Slider,
  SliderNumberField,
  Switch,
  Text,
  TextField,
} from "@phoenix/components";
import { Button } from "@phoenix/components/core/button";
import { SelectChevronUpDownIcon } from "@phoenix/components/core/icon";
import { Popover } from "@phoenix/components/core/overlay";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { ParamSpec } from "@phoenix/pages/playground/invocationParameterSpecs";
import {
  getVisibleInvocationParameterSpecs,
  readInvocationConfigField,
} from "@phoenix/pages/playground/providerAdapters";

/**
 * Sentinel used in the generic enum Select to represent "no value" (i.e. the
 * parameter is unset). Clicking it deletes the parameter row.
 */
const UNSET_VALUE = "__unset__";

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
    spec.type === "int" || spec.type === "float" ? spec.min : undefined;
  const numericMax =
    spec.type === "int" || spec.type === "float" ? spec.max : undefined;
  const minRuleMessage =
    numericMin != null
      ? `${spec.label || spec.name} must be at least ${numericMin}`
      : undefined;
  const maxRuleMessage =
    numericMax != null
      ? `${spec.label || spec.name} must be at most ${numericMax}`
      : undefined;

  switch (spec.type) {
    case "float":
      // A float with both `min` and `max` renders as a slider; otherwise as a
      // number input.
      if (numericMin != null && numericMax != null) {
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
    // fallthrough — unbounded float renders as a NumberField, same as int.
    // eslint-disable-next-line no-fallthrough
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
              minValue={numericMin}
              maxValue={numericMax}
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
    case "enum": {
      const currentValue = typeof value === "string" ? value : null;
      const selectedKey =
        currentValue && spec.values.includes(currentValue)
          ? currentValue
          : spec.required && spec.values.length > 0
            ? spec.values[0]
            : UNSET_VALUE;
      return (
        <Select
          selectedKey={selectedKey}
          onSelectionChange={(key) => {
            if (key === UNSET_VALUE) {
              onChange(undefined);
              return;
            }
            onChange(String(key));
          }}
          aria-label={spec.label}
        >
          <Label>{spec.label}</Label>
          <Button data-testid={`invocation-param-${spec.name}`}>
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover>
            <ListBox>
              {spec.required ? null : (
                <SelectItem id={UNSET_VALUE} textValue="unset">
                  <Text color="text-500" fontStyle="italic">
                    unset
                  </Text>
                </SelectItem>
              )}
              {spec.values.map((v) => (
                <SelectItem key={v} id={v}>
                  {spec.labels?.[v] ?? v}
                </SelectItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
      );
    }
    case "bool":
      return (
        <Switch onChange={onChange} defaultSelected={Boolean(value)}>
          {spec.label}
        </Switch>
      );
    default:
      return null;
  }
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
  const setInvocationParameterField = usePlaygroundContext(
    (state) => state.setInvocationParameterField
  );

  const specs = useMemo(
    () =>
      getVisibleInvocationParameterSpecs(
        model,
        instance.model.invocationParameters
      ),
    [model, instance.model.invocationParameters]
  );

  const onChange = useCallback(
    (spec: ParamSpec, value: unknown) => {
      setInvocationParameterField({
        instanceId,
        fieldName: spec.name,
        value,
      });
    },
    [instanceId, setInvocationParameterField]
  );

  const values = useMemo(() => {
    return specs.reduce<Record<string, unknown>>((acc, spec) => {
      const value = readInvocationConfigField(
        model.provider,
        instance.model.invocationParameters,
        spec.name
      );
      acc[spec.name] = value ?? null;
      return acc;
    }, {});
  }, [model.provider, instance.model.invocationParameters, specs]);

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
