/**
 * @generated SignedSource<<7b4c1a77fc6155f016f536f0d8dd75cd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorsTable_row$data = {
  readonly displayName: string;
  readonly evaluator: {
    readonly createdAt: string;
    readonly description: string | null;
    readonly id: string;
    readonly kind: EvaluatorKind;
    readonly name: string;
    readonly prompt?: {
      readonly id: string;
      readonly name: string;
    };
    readonly promptVersionTag?: {
      readonly name: string;
    } | null;
    readonly updatedAt: string;
  };
  readonly id: string;
  readonly updatedAt: string;
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

(node as any).hash = "495f9810691e3e40cb4aab8ea5dbb00e";

export default node;
