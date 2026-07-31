import { css } from "@emotion/react";
import { Suspense, useState } from "react";

import {
  Flex,
  Icon,
  Icons,
  Link,
  Loading,
  Radio,
  RadioGroup,
  Switch,
  Text,
} from "@phoenix/components";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { ModelMenu } from "@phoenix/components/generative/ModelMenu";
import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
  ModelProviders,
  ProviderToCredentialsConfigMap,
} from "@phoenix/constants/generativeConstants";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import {
  getBrowserBuiltInModel,
  useBrowserModelAvailability,
} from "./browserModel";
import { CardFootnote } from "./CardFootnote";
import { AI_SEARCH_PROVIDERS } from "./providerModels";
import { StatusText } from "./StatusText";
import type { AISearchModelConfig } from "./types";
import { resolveAISearchModelConfig } from "./types";

const formCSS = css`
  &[data-variant="popover"] .ai-search-settings__description {
    /* Sits under the switch label, aligned with its text */
    margin-top: calc(-1 * var(--global-dimension-size-50));
  }
  .ai-search-settings__section-label {
    font-size: var(--global-font-size-xxs);
    font-weight: var(--font-weight-heavy);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--global-text-color-500);
  }
  .radio-group {
    gap: var(--global-dimension-size-100);
    /* Beat the base group's fit-content width and start alignment so the
       options fill the form's width */
    &[data-direction="column"] {
      width: 100%;
      align-items: stretch;
    }
    .radio {
      box-sizing: border-box;
      align-items: flex-start;
      gap: var(--global-dimension-size-100);
      &::before {
        flex: none;
        /* Align the radio dot with the option title's first line */
        margin-top: var(--global-dimension-size-25);
      }
    }
  }
  /* The provider's model picker and credentials indent to the option text
     they belong to: past the radio dot in the popover, and additionally
     past the option card's padding on card surfaces */
  .ai-search-settings__provider-form {
    margin-inline-start: var(--global-dimension-size-300);
  }
  &[data-variant="card"] .ai-search-settings__provider-form {
    margin-inline-start: var(--global-dimension-size-450);
  }
  /* On the spacious card surfaces each model source renders as a bordered,
     selectable option card; in the popover the same options stay plain so
     the menu keeps a compact, list-like rhythm */
  &[data-variant="card"] .radio-group {
    /* The focused option card carries the ring itself — the default
       group-wide outline plus the dot's ring reads as two nested boxes
       around the bordered cards */
    &:has(.radio[data-focus-visible]) {
      outline: none;
    }
    .radio[data-focus-visible] {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
      &::before {
        outline: none;
      }
    }
  }
  &[data-variant="card"] .radio-group .radio {
    padding: var(--global-dimension-size-150);
    border: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    border-radius: var(--global-rounding-medium);
    cursor: pointer;
    transition:
      border-color 200ms ease-in-out,
      background-color 200ms ease-in-out;
    &:hover {
      background-color: var(--global-menu-item-background-color-hover);
    }
    &[data-selected] {
      border-color: var(--global-input-field-border-color-active);
      background-color: var(--global-menu-item-background-color-hover);
    }
  }
  .ai-search-settings__option-title {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    font-weight: var(--font-weight-heavy);
    line-height: var(--global-line-height-s);
  }
  /* Plain spans rather than slotted <Text> — inside a RadioGroup, RAC
     reserves Text for the group's description/errorMessage slots, and
     these are per-option annotations */
  .ai-search-settings__hint {
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    color: var(--global-text-color-700);
    font-weight: normal;
    &[data-tone="warning"] {
      color: var(--global-color-warning);
    }
  }
`;

/**
 * Names the on-device model the in-browser option actually runs — e.g.
 * "Gemini Nano — Chrome's built-in model" — so the choice is never a
 * mystery box. Falls back to a generic description in browsers without a
 * built-in model, where the availability status explains it's unsupported.
 */
function BrowserBuiltInModelText() {
  const builtInModel = getBrowserBuiltInModel();
  if (builtInModel === null) {
    return <>Runs on-device — queries never leave your browser</>;
  }
  return (
    <>
      {builtInModel.modelName} — {builtInModel.browserName}’s built-in model.
      Runs on-device; queries never leave your browser.
    </>
  );
}

/**
 * Availability of the on-device model as a short dot-status beside the
 * in-browser option's title.
 */
function BrowserModelAvailabilityStatus() {
  const availability = useBrowserModelAvailability();
  if (availability === null) {
    return null;
  }
  switch (availability) {
    case "available":
      return <StatusText tone="success">Ready</StatusText>;
    case "needs-download":
      return <StatusText>Downloads on first use</StatusText>;
    case "downloading":
      return <StatusText>Downloading…</StatusText>;
    default:
      return (
        <StatusText tone="warning">Not supported in this browser</StatusText>
      );
  }
}

/**
 * Points at where the selected provider's credentials live — Settings → AI
 * Providers, which writes the same browser-held store AI search reads.
 * Credentials are deliberately not entered here; when a required key is
 * missing the hint says so, otherwise it is a plain pointer.
 */
function ProviderCredentialsHint({ provider }: { provider: ModelProvider }) {
  const credentials = useCredentialsContext((state) => state[provider]);
  const missingRequired = ProviderToCredentialsConfigMap[provider].filter(
    (config) => config.isRequired && !credentials?.[config.envVarName]?.trim()
  );
  if (missingRequired.length > 0) {
    return (
      <div className="ai-search-settings__hint" data-tone="warning">
        {missingRequired.map(({ envVarName }) => envVarName).join(" and ")}{" "}
        {missingRequired.length > 1 ? "aren’t" : "isn’t"} set — configure the
        provider in{" "}
        <Link to="/settings/providers">Settings → AI Providers</Link>
      </div>
    );
  }
  return (
    <div className="ai-search-settings__hint">
      Keys are managed in{" "}
      <Link to="/settings/providers">Settings → AI Providers</Link>
    </div>
  );
}

function ProviderModelForm({
  config,
  onConfigChange,
}: {
  config: Extract<AISearchModelConfig, { kind: "provider" }>;
  onConfigChange: (config: AISearchModelConfig) => void;
}) {
  // Names the last picked model AI search cannot call from the browser.
  // The platform-wide picker lists every provider the deployment knows
  // about, but AI search can only reach the ones callable with a plain
  // browser-held API key — no custom providers, Azure, or Bedrock.
  const [unsupportedPickName, setUnsupportedPickName] = useState<string | null>(
    null
  );
  const handleModelChange = (model: ModelMenuValue) => {
    const isSupported =
      model.customProvider == null &&
      isModelProvider(model.provider) &&
      AI_SEARCH_PROVIDERS.includes(model.provider);
    if (!isSupported) {
      setUnsupportedPickName(
        model.customProvider?.name ??
          (isModelProvider(model.provider)
            ? ModelProviders[model.provider]
            : model.provider)
      );
      return;
    }
    setUnsupportedPickName(null);
    onConfigChange({
      kind: "provider",
      provider: model.provider,
      modelName: model.modelName,
    });
  };
  return (
    <Flex
      direction="column"
      gap="size-100"
      className="ai-search-settings__provider-form"
    >
      <Suspense fallback={<Loading size="S" />}>
        <ModelMenu
          value={
            config.modelName
              ? { provider: config.provider, modelName: config.modelName }
              : null
          }
          onChange={handleModelChange}
        />
      </Suspense>
      {unsupportedPickName !== null ? (
        <span className="ai-search-settings__hint" data-tone="warning">
          AI search can’t call {unsupportedPickName} from the browser — choose
          another provider
        </span>
      ) : null}
      <ProviderCredentialsHint provider={config.provider} />
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
 *
 * The `variant` tailors the form to its surface: `"popover"` (the default)
 * is the compact menu layout with the enable switch inline; `"card"` is the
 * spacious settings-card layout, where the hosting card owns the enable
 * switch (in its header) and each model source renders as a bordered
 * option card.
 */
export function AISearchSettingsForm({
  variant = "popover",
}: {
  variant?: "popover" | "card";
}) {
  const isEnabled = usePreferencesContext((state) => state.isAISearchEnabled);
  const setIsEnabled = usePreferencesContext(
    (state) => state.setIsAISearchEnabled
  );
  const modelConfig = resolveAISearchModelConfig(
    usePreferencesContext((state) => state.aiSearchModelConfig)
  );
  const setModelConfig = usePreferencesContext(
    (state) => state.setAISearchModelConfig
  );
  return (
    <div css={formCSS} data-variant={variant}>
      <Flex direction="column" gap="size-150">
        {variant === "popover" ? (
          <Switch isSelected={isEnabled} onChange={setIsEnabled}>
            AI Search
          </Switch>
        ) : null}
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
            <span className="ai-search-settings__section-label">
              Model source
            </span>
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
                        modelName: DEFAULT_MODEL_NAME,
                      }
                );
              }}
            >
              <Radio value="browser">
                <Flex direction="column" gap="size-25">
                  <span className="ai-search-settings__option-title">
                    In-browser AI
                    <BrowserModelAvailabilityStatus />
                  </span>
                  <span className="ai-search-settings__hint">
                    <BrowserBuiltInModelText />
                  </span>
                </Flex>
              </Radio>
              <Radio value="provider">
                <Flex direction="column" gap="size-25">
                  <span className="ai-search-settings__option-title">
                    Model provider
                  </span>
                  <span className="ai-search-settings__hint">
                    Sends queries to a provider of your choice, with an API key
                    stored only in this browser
                  </span>
                </Flex>
              </Radio>
            </RadioGroup>
            {modelConfig.kind === "provider" ? (
              <ProviderModelForm
                config={modelConfig}
                onConfigChange={setModelConfig}
              />
            ) : null}
            <CardFootnote icon={<Icon svg={<Icons.Lock />} />}>
              Only your query and the filter field vocabulary are sent to the
              model.
            </CardFootnote>
          </>
        ) : null}
      </Flex>
    </div>
  );
}
