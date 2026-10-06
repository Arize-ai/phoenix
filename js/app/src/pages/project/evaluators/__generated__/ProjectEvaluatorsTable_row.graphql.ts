/**
 * @generated SignedSource<<b3a37c37b821640a7c6453ae6df341ed>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type Language = "PYTHON" | "TYPESCRIPT";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI" | "ZAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "NEVER_RUN" | "OVERLOADED" | "QUEUED" | "RUNNING";
export type SandboxBackendType = "DAYTONA" | "DENO" | "DOCKER" | "E2B" | "MODAL" | "MONTY" | "VERCEL" | "WASM";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_row$data = {
  readonly enabled: boolean;
  readonly evaluationLoad: {
    readonly evaluationCount: number;
    readonly meanEvaluationSeconds: number | null;
    readonly shareOfEvaluationTime: number | null;
  };
  readonly evaluationTarget: EvaluationTarget;
  readonly evaluator: {
    readonly id: string;
    readonly kind: EvaluatorKind;
    readonly language?: Language;
    readonly outputConfigs: ReadonlyArray<{
      readonly annotationType?: AnnotationType;
      readonly lowerBound?: number | null;
      readonly name?: string;
      readonly optimizationDirection?: OptimizationDirection;
      readonly threshold?: number | null;
      readonly upperBound?: number | null;
      readonly values?: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
    }>;
    readonly prompt?: {
      readonly id: string;
      readonly name: string;
    };
    readonly promptVersion?: {
      readonly modelName: string;
      readonly modelProvider: ModelProvider;
    };
    readonly promptVersionTag?: {
      readonly name: string;
    } | null;
    readonly sandboxConfig?: {
      readonly id: string;
      readonly name: string;
      readonly provider: {
        readonly backendType: SandboxBackendType;
      };
    } | null;
  };
  readonly filterCondition: string;
  readonly id: string;
  readonly name: string;
  readonly runSummary: {
    readonly droppedCount: number;
    readonly evaluatedCount: number;
    readonly failedCount: number;
    readonly lastRunAt: string | null;
    readonly oldestQueuedAt: string | null;
    readonly queuedCount: number;
    readonly runningCount: number;
    readonly status: ProjectEvaluatorRunStatus;
  };
  readonly samplingRate: number;
  readonly updatedAt: string;
  readonly " $fragmentType": "ProjectEvaluatorsTable_row";
};
export type ProjectEvaluatorsTable_row$key = {
  readonly " $data"?: ProjectEvaluatorsTable_row$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_row">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ProjectEvaluatorsTable_row"
};

(node as any).hash = "41650685b08cc176bd207dec6312da7c";

export default node;
