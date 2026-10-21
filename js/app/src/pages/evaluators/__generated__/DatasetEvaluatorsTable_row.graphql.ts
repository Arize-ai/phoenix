/**
 * @generated SignedSource<<a17b0609bad6ea019c8abc05e493c934>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "DECISION" | "LLM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type Language = "PYTHON" | "TYPESCRIPT";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type SandboxBackendType = "DAYTONA" | "DENO" | "DOCKER" | "E2B" | "MODAL" | "MONTY" | "VERCEL" | "WASM";
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorsTable_row$data = {
  readonly description: string | null;
  readonly evaluator: {
    readonly createdAt: string;
    readonly decisionVersion?: {
      readonly decision: {
        readonly name: string;
      };
      readonly decisionId: string;
      readonly id: string;
      readonly modelName: string;
      readonly modelProvider: GenerativeProviderKey;
    };
    readonly id: string;
    readonly kind: EvaluatorKind;
    readonly language?: Language;
    readonly name: string;
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
    readonly updatedAt: string;
  };
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly user: {
    readonly profilePictureUrl: string | null;
    readonly username: string;
  } | null;
  readonly " $fragmentType": "DatasetEvaluatorsTable_row";
};
export type DatasetEvaluatorsTable_row$key = {
  readonly " $data"?: DatasetEvaluatorsTable_row$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_row">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "DatasetEvaluatorsTable_row"
};

(node as any).hash = "2f06cda3aa19562896660bf067e321db";

export default node;
