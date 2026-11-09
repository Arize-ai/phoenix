import type { Control } from "react-hook-form";
import { Controller, useFormState, useWatch } from "react-hook-form";

import { Input, Label, Switch, Text, TextField } from "@phoenix/components";

import type { ProviderFormData } from "./CustomProviderForm";
import { DECISION_SDK_LABELS, type DecisionSDK } from "./decisionSdks";
import { ProviderFormSection } from "./ProviderFormSection";

export function DecisionModelsSection({
  sdk,
  control,
  isSubmitting,
}: {
  sdk: DecisionSDK;
  control: Control<ProviderFormData>;
  isSubmitting: boolean;
}) {
  const isTypeSafe = sdk === "TYPESAFE";
  const isEnabled = useWatch({ control, name: "decision_enabled" });

  const enabledError = (
    useFormState({ control, name: "decision_enabled" }).errors as {
      decision_enabled?: { message?: string };
    }
  ).decision_enabled;
  const isOn = isTypeSafe || Boolean(isEnabled);

  return (
    <ProviderFormSection
      title="Decision models"
      subtitle={
        isTypeSafe
          ? "Always on: System One at this provider's base URL"
          : `${DECISION_SDK_LABELS[sdk]} at this provider's base URL, with its API key and headers`
      }
      extra={
        <Controller
          name="decision_enabled"
          control={control}
          render={({ field }) => (
            <Switch
              aria-label="Serve decision models"
              isSelected={isOn}
              isDisabled={isTypeSafe || isSubmitting}
              onChange={field.onChange}
            >
              {isOn ? "On" : "Off"}
            </Switch>
          )}
        />
      }
    >
      {enabledError?.message ? (
        <Text size="S" color="danger">
          {enabledError.message}
        </Text>
      ) : null}
      {isOn ? (
        <Controller
          name="decision_model_names"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? ""}
              isDisabled={isSubmitting}
            >
              <Label>Suggested model names</Label>
              <Input
                placeholder={
                  sdk === "TYPESAFE" ? "jev-latest, jev-1.14.0" : "gpt-6-luna"
                }
              />
              <Text slot="description">
                Optional, comma separated. Listed in the model menu; any model
                the endpoint accepts can be used.
              </Text>
            </TextField>
          )}
        />
      ) : null}
    </ProviderFormSection>
  );
}
