/**
 * @generated SignedSource<<6c73fb43e2deadaafeab068c4be9c999>>
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
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type ProjectEvaluatorRunStatus = "FAILING" | "HEALTHY" | "NEVER_RUN" | "QUEUED";
export type ProjectEvaluatorSchedulabilityReason = "DISABLED" | "TRACE_TARGET_UNSUPPORTED";
export type ProjectEvaluatorSchedulabilityStatus = "NOT_SCHEDULABLE" | "SCHEDULABLE";
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "MONTY" | "VERCEL" | "WASM";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_row$data = {
  readonly enabled: boolean;
  readonly evaluationTarget: EvaluationTarget;
  readonly evaluator: {
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
    readonly evaluatedCount: number;
    readonly failedCount: number;
    readonly lastRunAt: string | null;
    readonly queuedCount: number;
    readonly status: ProjectEvaluatorRunStatus;
  };
  readonly samplingRate: number;
  readonly schedulabilityReason: ProjectEvaluatorSchedulabilityReason | null;
  readonly schedulabilityStatus: ProjectEvaluatorSchedulabilityStatus;
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

(node as any).hash = "4077d339eee46a54c24d51345d464b8b";

export default node;
