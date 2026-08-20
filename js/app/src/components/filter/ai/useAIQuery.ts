import { useEffect, useRef, useState } from "react";

import {
  downloadBrowserModel,
  getBrowserModelAvailability,
} from "@phoenix/components/generative/browserAI";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import type { DSLFilterConditionValidationResult } from "../DSLFilterConditionField";
import { createAIQueryModel } from "./createAIQueryModel";
import { generateFilterCondition } from "./generateFilterCondition";
import type { AIQueryDSL } from "./types";
import { resolveAIQueryModelConfig } from "./types";

export type AIQueryStatus = "idle" | "downloading" | "generating";

/**
 * How one translation run ended. `cancelled` covers both an explicit cancel
 * and being superseded by a newer run — either way the caller should treat
 * the run as if it never happened. A success carries the validator's
 * passing verdict when one was obtained for exactly this condition, so the
 * caller can apply it without a second validation round-trip.
 */
export type AIQueryGenerateResult<
  TValidationResult extends DSLFilterConditionValidationResult =
    DSLFilterConditionValidationResult,
> =
  | {
      outcome: "success";
      condition: string;
      validation: TValidationResult | null;
    }
  | { outcome: "error"; message: string }
  | { outcome: "cancelled" };

export type UseAIQueryArgs<
  TValidationResult extends DSLFilterConditionValidationResult =
    DSLFilterConditionValidationResult,
> = {
  /**
   * The DSL to translate into, described by the entity layer.
   */
  dsl: AIQueryDSL;
  /**
   * When provided, generated expressions are validated and the model gets
   * one round to correct a rejected one. Typically the same validator the
   * field itself uses.
   */
  validate?: (
    condition: string
  ) => Promise<TValidationResult | null | undefined>;
};

export function toErrorMessage(error: unknown, fallback = "AI query failed") {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

/**
 * Orchestrates one natural-language → filter-expression translation at a
 * time: resolves the configured model (on-device browser model by default,
 * a provider called through the Phoenix server otherwise), downloads the
 * browser model on first use, streams the forming expression through
 * `onDelta`, and resolves with a {@link AIQueryGenerateResult} describing
 * how the run ended.
 */
export function useAIQuery<
  TValidationResult extends DSLFilterConditionValidationResult =
    DSLFilterConditionValidationResult,
>({ dsl, validate }: UseAIQueryArgs<TValidationResult>) {
  const modelConfig = resolveAIQueryModelConfig(
    usePreferencesContext((state) => state.aiQueryModelConfig)
  );
  const [status, setStatus] = useState<AIQueryStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // An unmounted hook can neither show nor apply a result — end the run so
  // it stops streaming and detaches its download-progress listener
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const generate = async (
    query: string,
    { onDelta }: { onDelta?: (partialExpression: string) => void } = {}
  ): Promise<AIQueryGenerateResult<TValidationResult>> => {
    // One translation at a time: a new request supersedes the previous one
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
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
          await downloadBrowserModel(setDownloadProgress, {
            signal: abortController.signal,
          });
        }
      }
      if (abortController.signal.aborted) {
        return { outcome: "cancelled" };
      }
      setStatus("generating");
      const model = await createAIQueryModel({ config: modelConfig });
      const { expression, validation } = await generateFilterCondition({
        model,
        dsl,
        query,
        onDelta,
        validate,
        abortSignal: abortController.signal,
      });
      // The stream ends without throwing on some abort paths — a cancelled
      // run must never pass its partial text off as a finished answer
      if (abortController.signal.aborted) {
        return { outcome: "cancelled" };
      }
      return { outcome: "success", condition: expression, validation };
    } catch (caught) {
      if (abortController.signal.aborted) {
        return { outcome: "cancelled" };
      }
      return { outcome: "error", message: toErrorMessage(caught) };
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

  return {
    status,
    downloadProgress,
    generate,
    cancel,
  };
}
