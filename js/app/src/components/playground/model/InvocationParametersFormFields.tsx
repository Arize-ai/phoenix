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
type InvocationParameterFieldProps = {
  spec: ParamSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  errors: FieldErrors<Record<string, unknown>>;
  control: Control<Record<string, unknown>>;
};

const InvocationParameterFormField = (props: InvocationParameterFieldProps) => {
  switch (props.spec.type) {
    case "float":
      return props.spec.min != null && props.spec.max != null ? (
        <InvocationParameterSlider {...props} />
      ) : (
        <InvocationParameterNumberField {...props} />
      );
    case "int":
      return <InvocationParameterNumberField {...props} />;
    case "string_list":
      return <InvocationParameterStringListField {...props} />;
    case "string":
      return <InvocationParameterStringField {...props} />;
    case "enum":
      return <InvocationParameterEnumField {...props} />;
    case "bool":
      return (
        <Switch
          onChange={props.onChange}
          defaultSelected={Boolean(props.value)}
        >
          {props.spec.label}
        </Switch>
      );
    default:
      return null;
  }
};

function getRequiredMessage(spec: ParamSpec): string | undefined {
  return spec.required ? `${spec.label || spec.name} is required` : undefined;
}

function InvocationParameterSlider({
  spec,
  value,
  onChange,
}: InvocationParameterFieldProps) {
  if (spec.type !== "float" || spec.min == null || spec.max == null)
    return null;
  const defaultValue = typeof value === "number" ? value : undefined;
  return (
    <Slider
      label={spec.label}
      defaultValue={defaultValue}
      step={0.1}
      minValue={spec.min}
      maxValue={spec.max}
      onChange={(next) =>
        onChange(Array.isArray(next) && next.length > 0 ? next[0] : next)
      }
    >
      <SliderNumberField defaultValue={defaultValue} />
    </Slider>
  );
}

function InvocationParameterNumberField({
  spec,
  value,
  onChange,
  errors,
  control,
}: InvocationParameterFieldProps) {
  if (spec.type !== "int" && spec.type !== "float") return null;
  const errorMessage = errors[spec.name]?.message;
  return (
    <Controller
      control={control}
      name={spec.name}
      rules={{
        required: getRequiredMessage(spec),
        min:
          spec.min == null
            ? undefined
            : `${spec.label || spec.name} must be at least ${spec.min}`,
        max:
          spec.max == null
            ? undefined
            : `${spec.label || spec.name} must be at most ${spec.max}`,
      }}
      render={({ field: { onBlur } }) => (
        <NumberField
          isRequired={spec.required}
          value={Number(value)}
          onBlur={onBlur}
          onChange={onChange}
          minValue={spec.min}
          maxValue={spec.max}
        >
          <Label>{spec.label}</Label>
          <Input />
          {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
        </NumberField>
      )}
    />
  );
}

function InvocationParameterStringListField({
  spec,
  value,
  onChange,
  errors,
  control,
}: InvocationParameterFieldProps) {
  if (
    spec.type !== "string_list" ||
    (!Array.isArray(value) && value !== undefined)
  ) {
    return null;
  }
  const errorMessage = errors[spec.name]?.message;
  return (
    <Controller
      control={control}
      name={spec.name}
      rules={{ required: getRequiredMessage(spec) }}
      render={({ field: { onBlur } }) => (
        <TextField
          isRequired={spec.required}
          defaultValue={value?.join(", ") ?? ""}
          onBlur={onBlur}
          onChange={(next) =>
            onChange(next === "" ? undefined : next.split(/, */g))
          }
        >
          <Label>{spec.label}</Label>
          <Input />
          {errorMessage ? (
            <FieldError>{errorMessage}</FieldError>
          ) : (
            <Text slot="description">A comma separated list of strings</Text>
          )}
        </TextField>
      )}
    />
  );
}

function InvocationParameterStringField({
  spec,
  value,
  onChange,
  errors,
  control,
}: InvocationParameterFieldProps) {
  if (spec.type !== "string") return null;
  const errorMessage = errors[spec.name]?.message;
  return (
    <Controller
      control={control}
      name={spec.name}
      rules={{ required: getRequiredMessage(spec) }}
      render={({ field: { onBlur } }) => (
        <TextField
          isRequired={spec.required}
          defaultValue={value?.toString() || ""}
          type="text"
          onBlur={onBlur}
          onChange={(next) => onChange(next === "" ? undefined : next)}
        >
          <Label>{spec.label}</Label>
          <Input />
          {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
        </TextField>
      )}
    />
  );
}

function InvocationParameterEnumField({
  spec,
  value,
  onChange,
}: InvocationParameterFieldProps) {
  if (spec.type !== "enum") return null;
  const selectedKey =
    typeof value === "string" && spec.values.includes(value)
      ? value
      : spec.required && spec.values.length > 0
        ? spec.values[0]
        : UNSET_VALUE;
  return (
    <Select
      selectedKey={selectedKey}
      onSelectionChange={(key) =>
        onChange(key === UNSET_VALUE ? undefined : String(key))
      }
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
          {spec.values.map((enumValue) => (
            <SelectItem key={enumValue} id={enumValue}>
              {spec.labels?.[enumValue] ?? enumValue}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

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
