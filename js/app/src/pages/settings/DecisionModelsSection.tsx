import type { Control } from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";

import { Input, Label, Switch, Text, TextField } from "@phoenix/components";

import type { ProviderFormData } from "./CustomProviderForm";
import type { DecisionSDK } from "./decisionSdks";
import { ProviderFormSection } from "./ProviderFormSection";

const DECISION_MODEL_FIELDS: Record<
  DecisionSDK,
  { placeholder: string; subtitle: string; description: string }
> = {
  OPENAI: {
    placeholder: "gpt-6-luna",
    subtitle:
      "OpenAI Decisions API at this provider's base URL, with its API key and headers",
    description:
      "Optional, comma separated. Leave empty to list the built-in models. Any model the endpoint accepts can be used.",
  },
  AZURE_OPENAI: {
    placeholder: "gpt-6-luna",
    subtitle:
      "Azure OpenAI Decisions API at this provider's Azure endpoint, with its credentials",
    description:
      "Optional, comma separated. Enter Azure deployment names. Leave empty to list the built-in models.",
  },
  TYPESAFE: {
    placeholder: "jev-latest, jev-1.14.0",
    subtitle: "Always on: System One at this provider's base URL",
    description:
      "Optional, comma separated. Leave empty to list the built-in models. Any model the endpoint accepts can be used.",
  },
  GOOGLE_GENAI: {
    placeholder: "gemini-decision-1",
    subtitle:
      "Gemini Decisions API at this provider's base URL, with its API key and headers",
    description:
      "Optional, comma separated. Leave empty to list the built-in models. Any model the endpoint accepts can be used.",
  },
};

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
  const isOn = isTypeSafe || Boolean(isEnabled);
  const fields = DECISION_MODEL_FIELDS[sdk];

  return (
    <ProviderFormSection
      title="Decision models"
      subtitle={fields.subtitle}
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
              labelPlacement="start"
            >
              {isOn ? "Enabled" : "Disabled"}
            </Switch>
          )}
        />
      }
    >
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
              <Label>Model names</Label>
              <Input placeholder={fields.placeholder} />
              <Text slot="description">{fields.description}</Text>
            </TextField>
          )}
        />
      ) : null}
    </ProviderFormSection>
  );
}
