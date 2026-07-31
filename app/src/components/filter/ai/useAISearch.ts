import { useRef, useState } from "react";

import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import type { DSLFilterConditionValidationResult } from "../DSLFilterConditionField";
import {
  downloadBrowserModel,
  getBrowserModelAvailability,
} from "./browserModel";
import { createAISearchModel } from "./createAISearchModel";
import { generateFilterCondition } from "./generateFilterCondition";
import type { AISearchDSL, AISearchModelConfig } from "./types";

const BROWSER_MODEL_CONFIG: AISearchModelConfig = { kind: "browser" };

export type AISearchStatus = "idle" | "downloading" | "generating";

/**
 * How one translation run ended. `cancelled` covers both an explicit cancel
 * and being superseded by a newer run — either way the caller should treat
 * the run as if it never happened.
 */
export type AISearchGenerateResult =
  | { outcome: "success"; condition: string }
  | { outcome: "error"; message: string }
  | { outcome: "cancelled" };

export type UseAISearchArgs = {
  /**
   * The DSL to translate into, described by the entity layer.
   */
  dsl: AISearchDSL;
  /**
   * When provided, generated expressions are validated and the model gets
   * one round to correct a rejected one. Typically the same validator the
   * field itself uses.
   */
  validate?: (
    condition: string
  ) => Promise<DSLFilterConditionValidationResult | null | undefined>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "AI search failed";
}

/**
 * Orchestrates one natural-language → filter-expression translation at a
 * time: resolves the configured model (on-device browser model by default,
 * a provider model with browser-held credentials otherwise), downloads the
 * browser model on first use, streams the forming expression through
 * `onDelta`, and resolves with a {@link AISearchGenerateResult} describing
 * how the run ended.
 */
export function useAISearch({ dsl, validate }: UseAISearchArgs) {
  const modelConfig =
    usePreferencesContext((state) => state.aiSearchModelConfig) ??
    BROWSER_MODEL_CONFIG;
  const credentials = useCredentialsContext((state) =>
    modelConfig.kind === "provider" ? state[modelConfig.provider] : undefined
  );
  const [status, setStatus] = useState<AISearchStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generate = async (
    query: string,
    { onDelta }: { onDelta?: (partialExpression: string) => void } = {}
  ): Promise<AISearchGenerateResult> => {
    // One translation at a time: a new request supersedes the previous one
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setError(null);
    try {
      if (modelConfig.kind === "browser") {
        const availability = await getBrowserModelAvailability();
        if (availability === "unsupported") {
          throw new Error(
            "This browser has no built-in AI model. Use Chrome or Edge, or configure a model provider."
          );
        }
        if (availability === "unavailable") {
          throw new Error(
            "The browser's built-in AI model is unavailable on this device. Configure a model provider instead."
          );
        }
        if (
          availability === "needs-download" ||
          availability === "downloading"
        ) {
          setStatus("downloading");
          setDownloadProgress(0);
          await downloadBrowserModel(setDownloadProgress);
        }
      }
      if (abortController.signal.aborted) {
        return { outcome: "cancelled" };
      }
      setStatus("generating");
      const model = await createAISearchModel({
        config: modelConfig,
        credentials:
          modelConfig.kind === "provider"
            ? { [modelConfig.provider]: credentials }
            : undefined,
      });
      const condition = await generateFilterCondition({
        model,
        dsl,
        query,
        onDelta,
        validate,
        abortSignal: abortController.signal,
      });
      return { outcome: "success", condition };
    } catch (caught) {
      if (abortController.signal.aborted) {
        return { outcome: "cancelled" };
      }
      const message = toErrorMessage(caught);
      setError(message);
      return { outcome: "error", message };
    } finally {
      // A superseding run owns the status now — only the latest run resets it
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
        setStatus("idle");
      }
    }
  };

  const cancel = () => {
    abortControllerRef.current?.abort();
  };

  const clearError = () => {
    setError(null);
  };

  return {
    status,
    downloadProgress,
    error,
    modelConfig,
    generate,
    cancel,
    clearError,
  };
}
