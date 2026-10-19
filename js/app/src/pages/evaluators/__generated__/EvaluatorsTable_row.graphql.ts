/**
 * @generated SignedSource<<f96b44be7c0f0748f515a70e4ec69fd4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "DECISION" | "LLM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
import { FragmentRefs } from "relay-runtime";
export type EvaluatorsTable_row$data = {
  readonly createdAt: string;
  readonly datasetEvaluators: ReadonlyArray<{
    readonly dataset: {
      readonly id: string;
      readonly name: string;
    };
    readonly description: string | null;
    readonly evaluator: {
      readonly kind: EvaluatorKind;
    };
    readonly id: string;
    readonly name: string;
    readonly updatedAt: string;
    readonly user: {
      readonly profilePictureUrl: string | null;
      readonly username: string;
    } | null;
  }>;
  readonly datasets: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly decisionVersion?: {
    readonly decisionId: string;
    readonly id: string;
    readonly modelName: string;
    readonly modelProvider: GenerativeProviderKey;
    readonly sequenceNumber: number;
  };
  readonly description: string | null;
  readonly id: string;
  readonly kind: EvaluatorKind;
  readonly name: string;
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly gradientEndColor: string;
        readonly gradientStartColor: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
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
  readonly updatedAt: string;
  readonly user?: {
    readonly profilePictureUrl: string | null;
    readonly username: string;
  } | null;
  readonly " $fragmentType": "EvaluatorsTable_row";
};
export type EvaluatorsTable_row$key = {
  readonly " $data"?: EvaluatorsTable_row$data;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorsTable_row">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "EvaluatorsTable_row"
};

(node as any).hash = "dcfd6677551b5a73445a623e4cf407f6";

export default node;
