/**
 * @generated SignedSource<<eea4e3e5dc074bfb403dcb5ec1e5af62>>
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
    readonly updatedAt: string;
  };
  readonly id: string;
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

(node as any).hash = "715dc1da8aaa8d69eb23436d5cd166dd";

export default node;
