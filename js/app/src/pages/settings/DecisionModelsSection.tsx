import { css } from "@emotion/react";
import { useEffect, useRef, useState } from "react";
import type {
  Control,
  UseFormGetValues,
  UseFormSetValue,
} from "react-hook-form";
import { Controller, useFormState, useWatch } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  FieldError,
  Flex,
  Input,
  Label,
  ListBox,
  Popover,
  ProgressCircle,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Switch,
  Text,
  TextField,
} from "@phoenix/components";
import type { GenerativeModelSDK } from "@phoenix/constants/generativeConstants";

import type { DecisionModelsSectionTestMutation } from "./__generated__/DecisionModelsSectionTestMutation.graphql";
import type { ProviderFormData } from "./CustomProviderForm";
import { buildClientConfig } from "./customProviderFormUtils";
import {
  azureChatBaseUrl,
  DECISION_SDK_OPTIONS,
  type DecisionSDK,
  decisionEndpointUrl,
  guessDecisionBaseUrl,
} from "./decisionEndpoints";
import { ProviderFormSection } from "./ProviderFormSection";

const testDecisionEndpointMutation = graphql`
  mutation DecisionModelsSectionTestMutation(
    $input: GenerativeModelCustomerProviderConfigInput!
  ) {
    testGenerativeModelCustomProviderDecisionEndpoint(input: $input) {
      error
      url
    }
  }
`;

const decisionClientCSS = css`
  flex: none;
  width: 180px;
`;

const decisionBaseUrlCSS = css`
  flex: 1 1 auto;
  min-width: 0;
`;

const endpointPreviewCSS = css`
  font-family: var(--global-font-family-mono);
  word-break: break-all;
`;

/** The chat base URL the provider is configured with, by SDK. */
function useChatBaseUrl({
  control,
  sdk,
}: {
  control: Control<ProviderFormData>;
  sdk: GenerativeModelSDK;
}): string | null {
  const [openaiBaseUrl, azureEndpoint, typesafeBaseUrl] = useWatch({
    control,
    name: ["openai_base_url", "azure_endpoint", "typesafe_base_url"],
  });
  if (sdk === "AZURE_OPENAI") {
    return azureChatBaseUrl(azureEndpoint);
  }
  if (sdk === "TYPESAFE") {
    return typesafeBaseUrl ?? null;
  }
  return openaiBaseUrl ?? null;
}

type TestResult = {
  signature: string;
  error: string | null;
  url: string | null;
};

/**
 * The "Decision models" section of a custom provider: whether it serves
 * decision models, through which client, at which base URL, with optional
 * suggested model names, and a check of the exact endpoint a run calls.
 *
 * A TypeSafe provider always serves decision models through System One, at
 * its own base URL.
 */
export function DecisionModelsSection({
  sdk,
  control,
  getValues,
  setValue,
  isSubmitting,
}: {
  sdk: GenerativeModelSDK;
  control: Control<ProviderFormData>;
  getValues: UseFormGetValues<ProviderFormData>;
  setValue: UseFormSetValue<ProviderFormData>;
  isSubmitting: boolean;
}) {
  const isTypeSafe = sdk === "TYPESAFE";
  const [isEnabled, decisionSdk, decisionBaseUrl] = useWatch({
    control,
    name: ["decision_enabled", "decision_sdk", "decision_base_url"],
  });
  const chatBaseUrl = useChatBaseUrl({ control, sdk });
  const client: DecisionSDK = isTypeSafe ? "TYPESAFE" : decisionSdk;
  const guess = guessDecisionBaseUrl({ decisionSdk: client, chatBaseUrl });
  const effectiveBaseUrl = isTypeSafe
    ? guessDecisionBaseUrl({ decisionSdk: "TYPESAFE", chatBaseUrl })
    : decisionBaseUrl?.trim() || guess;
  const endpointUrl = decisionEndpointUrl({
    decisionSdk: client,
    baseUrl: effectiveBaseUrl,
  });

  /** Fill the base URL with the guess unless the user typed their own. */
  const prefillBaseUrl = ({
    nextClient,
    previousGuess,
  }: {
    nextClient: DecisionSDK;
    previousGuess: string | null;
  }) => {
    const current = getValues("decision_base_url")?.trim();
    if (!current || current === previousGuess) {
      setValue(
        "decision_base_url",
        guessDecisionBaseUrl({ decisionSdk: nextClient, chatBaseUrl }),
        { shouldDirty: true, shouldValidate: true }
      );
    }
  };

  // An untouched guess follows the chat base URL, so it never goes stale.
  const previousChatBaseUrl = useRef(chatBaseUrl);
  useEffect(() => {
    const previous = previousChatBaseUrl.current;
    previousChatBaseUrl.current = chatBaseUrl;
    if (isTypeSafe || previous === chatBaseUrl) {
      return;
    }
    const current = getValues("decision_base_url")?.trim();
    const previousGuess = guessDecisionBaseUrl({
      decisionSdk: getValues("decision_sdk"),
      chatBaseUrl: previous,
    });
    if (current && current === previousGuess) {
      setValue(
        "decision_base_url",
        guessDecisionBaseUrl({
          decisionSdk: getValues("decision_sdk"),
          chatBaseUrl,
        }),
        { shouldDirty: true, shouldValidate: true }
      );
    }
  }, [chatBaseUrl, getValues, isTypeSafe, setValue]);

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
          : "Uses this provider's API key and headers"
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
              onChange={(next) => {
                field.onChange(next);
                if (next) {
                  prefillBaseUrl({ nextClient: client, previousGuess: null });
                }
              }}
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
        <>
          {isTypeSafe ? (
            <Text size="S" color="text-700">
              <EndpointPreview url={endpointUrl} />
            </Text>
          ) : (
            <Flex direction="row" gap="size-100" alignItems="start">
              <Controller
                name="decision_sdk"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onChange={(key) => {
                      if (key == null || key === field.value) return;
                      const previousGuess = guessDecisionBaseUrl({
                        decisionSdk: field.value,
                        chatBaseUrl,
                      });
                      field.onChange(key);
                      prefillBaseUrl({
                        nextClient: key as DecisionSDK,
                        previousGuess,
                      });
                    }}
                    isDisabled={isSubmitting}
                    css={decisionClientCSS}
                  >
                    <Label>Decision client</Label>
                    <Button>
                      <SelectValue />
                      <SelectChevronUpDownIcon />
                    </Button>
                    <Popover>
                      <ListBox>
                        {DECISION_SDK_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.id}
                            id={option.id}
                            textValue={option.label}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </ListBox>
                    </Popover>
                  </Select>
                )}
              />
              <Controller
                name="decision_base_url"
                control={control}
                render={({ field, fieldState: { invalid, error } }) => (
                  <TextField
                    isInvalid={invalid}
                    {...field}
                    value={field.value ?? ""}
                    isDisabled={isSubmitting}
                    css={decisionBaseUrlCSS}
                  >
                    <Label>Decision base URL</Label>
                    <Input placeholder={guess} />
                    {error ? (
                      <FieldError>{error.message}</FieldError>
                    ) : (
                      <Text slot="description">
                        <EndpointPreview url={endpointUrl} />
                      </Text>
                    )}
                  </TextField>
                )}
              />
            </Flex>
          )}
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
                    client === "TYPESAFE"
                      ? "jev-latest, jev-1.14.0"
                      : "gpt-6-luna"
                  }
                />
                <Text slot="description">
                  Optional, comma separated. Listed in the model menu; any model
                  the endpoint accepts can be used.
                </Text>
              </TextField>
            )}
          />
          <TestDecisionEndpoint
            control={control}
            getValues={getValues}
            sdk={sdk}
          />
        </>
      ) : null}
    </ProviderFormSection>
  );
}

/** The exact URL a decision run posts to. */
function EndpointPreview({ url }: { url: string }) {
  return (
    <span css={endpointPreviewCSS} data-testid="decision-endpoint">
      POST {url}
    </span>
  );
}

function useHasApiKey({
  control,
  sdk,
}: {
  control: Control<ProviderFormData>;
  sdk: GenerativeModelSDK;
}): boolean {
  const [openaiKey, azureKey, azureAuthMethod, azureEndpoint, typesafeKey] =
    useWatch({
      control,
      name: [
        "openai_api_key",
        "azure_api_key",
        "azure_auth_method",
        "azure_endpoint",
        "typesafe_api_key",
      ],
    });
  switch (sdk) {
    case "OPENAI":
      return Boolean(openaiKey);
    case "AZURE_OPENAI":
      return Boolean(
        azureEndpoint && azureAuthMethod === "api_key" && azureKey
      );
    case "TYPESAFE":
      return Boolean(typesafeKey);
    default:
      return false;
  }
}

/**
 * Posts to the exact decision URL a run would, asking for a model that does
 * not exist; it passes only when the endpoint rejects that model by name.
 */
function TestDecisionEndpoint({
  control,
  getValues,
  sdk,
}: {
  control: Control<ProviderFormData>;
  getValues: UseFormGetValues<ProviderFormData>;
  sdk: GenerativeModelSDK;
}) {
  const [commit, isTesting] = useMutation<DecisionModelsSectionTestMutation>(
    testDecisionEndpointMutation
  );
  const [result, setResult] = useState<TestResult | null>(null);
  const watchedValues = useWatch({ control });
  const signature = JSON.stringify(watchedValues);
  const canTest = useHasApiKey({ control, sdk });
  // A result for values that have since changed says nothing about these.
  const current = result?.signature === signature ? result : null;

  const handleTest = () => {
    const testedSignature = JSON.stringify(getValues());
    commit({
      variables: { input: buildClientConfig(getValues()) },
      onCompleted: (response) => {
        const payload =
          response.testGenerativeModelCustomProviderDecisionEndpoint;
        setResult({
          signature: testedSignature,
          error: payload.error ?? null,
          url: payload.url ?? null,
        });
      },
      onError: (error) => {
        setResult({
          signature: testedSignature,
          error: error.message,
          url: null,
        });
      },
    });
  };

  return (
    <Flex direction="column" gap="size-100">
      <Flex direction="row" gap="size-200" alignItems="center">
        <Button
          variant="default"
          size="S"
          onPress={handleTest}
          isDisabled={isTesting || !canTest}
        >
          {isTesting ? (
            <Flex direction="row" gap="size-50" alignItems="center">
              <ProgressCircle
                isIndeterminate
                size="S"
                aria-label="Testing decision endpoint"
              />
              <span>Testing</span>
            </Flex>
          ) : (
            "Test decision endpoint"
          )}
        </Button>
        {current == null && !isTesting ? (
          <Text color="text-700" size="S">
            Asks the endpoint about a model that does not exist; nothing runs
          </Text>
        ) : null}
      </Flex>
      {current != null ? (
        <Alert
          variant={current.error == null ? "success" : "danger"}
          title={
            current.error == null
              ? "Decision endpoint works"
              : "Decision endpoint check failed"
          }
          dismissable
          onDismissClick={() => setResult(null)}
        >
          {current.error ??
            `${current.url ?? "The endpoint"} accepted the API key and recognized the request.`}
        </Alert>
      ) : null}
    </Flex>
  );
}
