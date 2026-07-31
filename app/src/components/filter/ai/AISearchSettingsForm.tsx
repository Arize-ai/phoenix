import { css } from "@emotion/react";
import { useEffect, useState } from "react";

import {
  Button,
  Flex,
  Input,
  Label,
  ListBox,
  Popover,
  Radio,
  RadioGroup,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Switch,
  Text,
  TextField,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
  ModelProviders,
  ProviderToCredentialsConfigMap,
} from "@phoenix/constants/generativeConstants";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { BrowserModelAvailability } from "./browserModel";
import { getBrowserModelAvailability } from "./browserModel";
import { AI_SEARCH_PROVIDERS } from "./providerModels";
import type { AISearchModelConfig } from "./types";

const formCSS = css`
  .ai-search-settings__description {
    /* Sits under the switch label, aligned with its text */
    margin-top: calc(-1 * var(--global-dimension-size-50));
  }
  .radio-group {
    gap: var(--global-dimension-size-100);
  }
  /* Plain spans rather than slotted <Text> — inside a RadioGroup, RAC
     reserves Text for the group's description/errorMessage slots, and
     these are per-option annotations */
  .ai-search-settings__hint {
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    color: var(--global-text-color-700);
    &[data-tone="success"] {
      color: var(--global-color-success);
    }
    &[data-tone="warning"] {
      color: var(--global-color-warning);
    }
  }
`;

function suggestedModelName(provider: ModelProvider): string {
  return provider === "OPENAI" ? DEFAULT_MODEL_NAME : "";
}

/**
 * Availability of the on-device model, fetched when the settings surface
 * mounts (i.e. each time it opens, so a finished download is reflected on
 * the next look).
 */
function BrowserModelAvailabilityText() {
  const [availability, setAvailability] =
    useState<BrowserModelAvailability | null>(null);
  useEffect(() => {
    let isCancelled = false;
    void getBrowserModelAvailability().then((result) => {
      if (!isCancelled) {
        setAvailability(result);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);
  if (availability === null) {
    return null;
  }
  switch (availability) {
    case "available":
      return (
        <span className="ai-search-settings__hint" data-tone="success">
          Ready to use
        </span>
      );
    case "needs-download":
      return (
        <span className="ai-search-settings__hint">
          The model downloads on first use
        </span>
      );
    case "downloading":
      return (
        <span className="ai-search-settings__hint">
          The model is downloading…
        </span>
      );
    default:
      return (
        <span className="ai-search-settings__hint" data-tone="warning">
          Not supported in this browser — use a model provider instead
        </span>
      );
  }
}

/**
 * Inline inputs for the selected provider's required credentials, written
 * straight to the browser-held credentials store (the same store the
 * playground reads) so a key entered here works everywhere and vice versa.
 */
function ProviderCredentialInputs({ provider }: { provider: ModelProvider }) {
  const setCredential = useCredentialsContext((state) => state.setCredential);
  const credentials = useCredentialsContext((state) => state[provider]);
  const requirements = ProviderToCredentialsConfigMap[provider].filter(
    (config) => config.isRequired
  );
  if (requirements.length === 0) {
    return null;
  }
  return (
    <Flex direction="column" gap="size-100">
      {requirements.map(({ envVarName }) => (
        <TextField
          key={envVarName}
          type="password"
          size="S"
          value={credentials?.[envVarName] ?? ""}
          onChange={(value) => {
            setCredential({
              provider,
              envVarName,
              value: value.trim() || null,
            });
          }}
        >
          <Label>{envVarName}</Label>
          <Input placeholder="stored only in this browser" />
        </TextField>
      ))}
    </Flex>
  );
}

function ProviderModelForm({
  config,
  onConfigChange,
}: {
  config: Extract<AISearchModelConfig, { kind: "provider" }>;
  onConfigChange: (config: AISearchModelConfig) => void;
}) {
  return (
    <Flex direction="column" gap="size-100" marginStart="size-300">
      <Select
        size="S"
        value={config.provider}
        onChange={(key) => {
          if (typeof key === "string" && isModelProvider(key)) {
            onConfigChange({
              kind: "provider",
              provider: key,
              modelName: suggestedModelName(key),
            });
          }
        }}
        aria-label="Model provider"
      >
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Popover>
          <ListBox>
            {AI_SEARCH_PROVIDERS.map((provider) => (
              <SelectItem
                key={provider}
                id={provider}
                textValue={ModelProviders[provider]}
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <GenerativeProviderIcon provider={provider} height={16} />
                  {ModelProviders[provider]}
                </Flex>
              </SelectItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
      <TextField
        size="S"
        value={config.modelName}
        onChange={(modelName) => {
          onConfigChange({ ...config, modelName });
        }}
        aria-label="Model name"
      >
        <Input placeholder="model name (e.g. gpt-5-mini)" />
      </TextField>
      <ProviderCredentialInputs provider={config.provider} />
    </Flex>
  );
}

/**
 * The AI search configuration: the feature switch and, when enabled, the
 * model choice — on-device browser AI by default, or a provider called with
 * credentials that never leave this browser. Bound to the persisted
 * preferences store, so every surface that renders it (the filter field's
 * popover, the settings page, the profile page) reads and writes the same
 * setting.
 */
export function AISearchSettingsForm() {
  const isEnabled = usePreferencesContext((state) => state.isAISearchEnabled);
  const setIsEnabled = usePreferencesContext(
    (state) => state.setIsAISearchEnabled
  );
  const modelConfig =
    usePreferencesContext((state) => state.aiSearchModelConfig) ??
    ({ kind: "browser" } satisfies AISearchModelConfig);
  const setModelConfig = usePreferencesContext(
    (state) => state.setAISearchModelConfig
  );
  return (
    <div css={formCSS}>
      <Flex direction="column" gap="size-150">
        <Switch isSelected={isEnabled} onChange={setIsEnabled}>
          AI Search
        </Switch>
        <Text
          size="XS"
          color="text-700"
          className="ai-search-settings__description"
        >
          Describe a filter in plain language and press Enter to convert it to a
          filter expression.
        </Text>
        {isEnabled ? (
          <>
            <RadioGroup
              aria-label="AI search model"
              direction="column"
              value={modelConfig.kind}
              onChange={(kind) => {
                setModelConfig(
                  kind === "browser"
                    ? { kind: "browser" }
                    : {
                        kind: "provider",
                        provider: DEFAULT_MODEL_PROVIDER,
                        modelName: suggestedModelName(DEFAULT_MODEL_PROVIDER),
                      }
                );
              }}
            >
              <Radio value="browser">
                <Flex direction="column" gap="size-25">
                  In-browser AI
                  <span className="ai-search-settings__hint">
                    Runs on-device — queries never leave your browser
                  </span>
                  <BrowserModelAvailabilityText />
                </Flex>
              </Radio>
              <Radio value="provider">Model provider</Radio>
            </RadioGroup>
            {modelConfig.kind === "provider" ? (
              <ProviderModelForm
                config={modelConfig}
                onConfigChange={setModelConfig}
              />
            ) : null}
            <Text size="XS" color="text-300">
              Only your query and the filter field vocabulary are sent to the
              model.
            </Text>
          </>
        ) : null}
      </Flex>
    </div>
  );
}
