/**
 * @generated SignedSource<<965113e717b30e0088b141e1e6e4064f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type Language = "PYTHON" | "TYPESCRIPT";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "MONTY" | "VERCEL" | "WASM";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_row$data = {
  readonly enabled: boolean;
  readonly evaluationTarget: EvaluationTarget;
  readonly evaluator: {
    readonly kind: EvaluatorKind;
    readonly language?: Language;
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

(node as any).hash = "b3af2600cc18279e0fae388fb2e9b0cf";

export default node;
