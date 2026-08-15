import { css } from "@emotion/react";

import { Flex, Link } from "@phoenix/components";
import {
  BROWSER_AI_MENU_ITEM_ID,
  BrowserModelAvailabilityStatus,
  getBrowserBuiltInModel,
  useBrowserAIMenuItem,
} from "@phoenix/components/generative/browserAI";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { ModelMenu } from "@phoenix/components/generative/ModelMenu";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { AIQueryModelConfig } from "./types";

const pickerCSS = css`
  /* Matches the description under a standard form field (fieldBaseCSS
     styles [slot="description"]) */
  .ai-query-model-picker__hint {
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    color: var(--field-description-text-color);
    font-weight: normal;
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
 * The unified model picker for AI query: one menu offering Browser AI
 * (when this browser has a built-in model) alongside the providers served
 * through the Phoenix server's OpenAI-compatible proxy. Every model the
 * platform-wide picker offers works here — the server holds the connection
 * details and credentials, so custom providers, Azure, and Bedrock are all
 * callable.
 */
export function AIQueryModelPicker({
  config,
  onConfigChange,
  isCompact = false,
}: {
  config: AIQueryModelConfig;
  onConfigChange: (config: AIQueryModelConfig) => void;
  /**
   * Drops the descriptive hints and healthy-state status under the picker,
   * leaving only warnings (an unusable browser model) — for the settings
   * dropdown, where the Generative AI page carries the detail instead.
   */
  isCompact?: boolean;
}) {
  const browserAIItem = useBrowserAIMenuItem();
  const handleModelChange = (model: ModelMenuValue) => {
    if (model.customProvider != null) {
      onConfigChange({
        kind: "server",
        source: "custom",
        providerId: model.customProvider.id,
        providerName: model.customProvider.name,
        modelName: model.modelName,
      });
      return;
    }
    if (!isModelProvider(model.provider)) {
      return;
    }
    onConfigChange({
      kind: "server",
      source: "builtin",
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
              config.kind === "server" && config.modelName
                ? {
                    // The provider slot only satisfies the value shape for
                    // custom providers — the menu ignores it (including its
                    // icon) whenever `customProvider` is set
                    provider:
                      config.source === "builtin" ? config.provider : "OPENAI",
                    modelName: config.modelName,
                    customProvider:
                      config.source === "custom"
                        ? { id: config.providerId, name: config.providerName }
                        : undefined,
                  }
                : null
            }
            onChange={handleModelChange}
            placement="bottom start"
            shouldFlip
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
        {isCompact ? null : (
          <span className="ai-query-model-picker__hint">
            {config.kind === "browser" ? (
              <BrowserBuiltInModelText />
            ) : (
              <>
                Provider credentials are managed on the server in{" "}
                <Link to="/settings/providers">Settings → AI Providers</Link>
              </>
            )}
          </span>
        )}
      </Flex>
    </div>
  );
}
