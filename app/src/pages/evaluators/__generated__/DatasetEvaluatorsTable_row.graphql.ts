/**
 * @generated SignedSource<<7d0236a912dbab019d7b2196b63bfab1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorsTable_row$data = {
  readonly description: string | null;
  readonly evaluator: {
    readonly createdAt: string;
    readonly environmentMismatch?: boolean;
    readonly id: string;
    readonly kind: EvaluatorKind;
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

(node as any).hash = "fb3d3d8ad5d3762bab2cd25d872a8043";

export default node;
