import { css } from "@emotion/react";

import { Flex, Link } from "@phoenix/components";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { ModelMenu } from "@phoenix/components/generative/ModelMenu";
import { ProviderToCredentialsConfigMap } from "@phoenix/constants/generativeConstants";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import {
  BROWSER_AI_MENU_ITEM_ID,
  BrowserModelAvailabilityStatus,
  useBrowserAIMenuItem,
} from "./browserAIMenuItem";
import { getBrowserBuiltInModel } from "./browserModel";
import { isAISearchProviderAvailable } from "./providerModels";
import type { AISearchModelConfig } from "./types";

const pickerCSS = css`
  /* Matches the description under a standard form field (fieldBaseCSS
     styles [slot="description"]), with a warning tone for missing keys */
  .ai-search-model-picker__hint {
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    color: var(--field-description-text-color);
    font-weight: normal;
    &[data-tone="warning"] {
      color: var(--global-color-warning);
    }
  }
`;

/**
 * Names the on-device model Browser AI actually runs — e.g. "Gemini Nano —
 * Chrome's built-in model" — so the choice is never a mystery box. Falls
 * back to a generic description in browsers without a built-in model, where
 * the availability status explains it's unsupported.
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
 * Points at where the selected provider's credentials live — Settings → AI
 * Providers, which writes the same browser-held store AI search reads.
 * Credentials are deliberately not entered here; when a required key is
 * missing the hint says so, otherwise it is a plain pointer. With
 * `warningOnly` the pointer is dropped and only the missing-key warning
 * renders — the compact popover stays quiet unless something is broken.
 */
function ProviderCredentialsHint({
  provider,
  warningOnly = false,
}: {
  provider: ModelProvider;
  warningOnly?: boolean;
}) {
  const credentials = useCredentialsContext((state) => state[provider]);
  const missingRequired = ProviderToCredentialsConfigMap[provider].filter(
    (config) => config.isRequired && !credentials?.[config.envVarName]?.trim()
  );
  if (missingRequired.length > 0) {
    return (
      <div className="ai-search-model-picker__hint" data-tone="warning">
        {missingRequired.map(({ envVarName }) => envVarName).join(" and ")}{" "}
        {missingRequired.length > 1 ? "aren’t" : "isn’t"} set — configure the
        provider in{" "}
        <Link to="/settings/providers">Settings → AI Providers</Link>
      </div>
    );
  }
  if (warningOnly) {
    return null;
  }
  return (
    <div className="ai-search-model-picker__hint">
      Keys are managed in{" "}
      <Link to="/settings/providers">Settings → AI Providers</Link>
    </div>
  );
}

/**
 * The unified model picker for AI search: one menu offering Browser AI
 * (when this browser has a built-in model) alongside the hosted providers,
 * with a hint below describing the current selection. The platform-wide
 * picker lists every provider the deployment knows about, including ones
 * whose credentials live only on the server; AI search calls providers
 * straight from the browser, so the menu is narrowed to the providers it
 * can actually reach with the keys held here.
 */
export function AISearchModelPicker({
  config,
  onConfigChange,
  isCompact = false,
}: {
  config: AISearchModelConfig;
  onConfigChange: (config: AISearchModelConfig) => void;
  /**
   * Drops the descriptive hints and healthy-state status under the picker,
   * leaving only warnings (a missing credential, an unusable browser
   * model) — for the settings dropdown, where the Generative AI page
   * carries the detail instead.
   */
  isCompact?: boolean;
}) {
  const localCredentials = useCredentialsContext((state) => state);
  const browserAIItem = useBrowserAIMenuItem();
  const handleModelChange = (model: ModelMenuValue) => {
    if (!isModelProvider(model.provider)) {
      return;
    }
    onConfigChange({
      kind: "provider",
      provider: model.provider,
      modelName: model.modelName,
    });
  };
  return (
    <div css={pickerCSS}>
      <Flex direction="column" gap="size-50" alignItems="start">
        <Flex direction="row" gap="size-100" alignItems="center">
          <ModelMenu
            value={
              config.kind === "provider" && config.modelName
                ? { provider: config.provider, modelName: config.modelName }
                : null
            }
            onChange={handleModelChange}
            placement="bottom start"
            shouldFlip
            providerFilter={(provider) =>
              isAISearchProviderAvailable({
                providerKey: provider.key,
                credentials: localCredentials,
              })
            }
            includeCustomProviders={false}
            leadingItems={browserAIItem ? [browserAIItem] : undefined}
            selectedLeadingItemId={
              config.kind === "browser" ? BROWSER_AI_MENU_ITEM_ID : undefined
            }
            onLeadingItemSelect={() => onConfigChange({ kind: "browser" })}
          />
          {config.kind === "browser" ? (
            <BrowserModelAvailabilityStatus warningOnly={isCompact} />
          ) : null}
        </Flex>
        {config.kind === "browser" ? (
          isCompact ? null : (
            <span className="ai-search-model-picker__hint">
              <BrowserBuiltInModelText />
            </span>
          )
        ) : (
          <ProviderCredentialsHint
            provider={config.provider}
            warningOnly={isCompact}
          />
        )}
      </Flex>
    </div>
  );
}
