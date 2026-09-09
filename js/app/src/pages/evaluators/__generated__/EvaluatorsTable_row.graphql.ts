/**
 * @generated SignedSource<<c6ecd759d3f5789e39202df2b8653164>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI" | "ZAI";
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

(node as any).hash = "f354a35aaba4addcc82ffe1329768138";

export default node;
