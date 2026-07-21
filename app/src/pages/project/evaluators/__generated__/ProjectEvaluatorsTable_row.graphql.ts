/**
 * @generated SignedSource<<fd2cb24ca8d80a230acd7569b3da8de8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_row$data = {
  readonly evaluationTarget: EvaluationTarget;
  readonly evaluator: {
    readonly id: string;
    readonly kind: EvaluatorKind;
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

(node as any).hash = "41ba90f01984a0e551f2779681349b5f";

export default node;
