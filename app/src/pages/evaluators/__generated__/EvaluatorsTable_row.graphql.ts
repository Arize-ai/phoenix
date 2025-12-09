/**
 * @generated SignedSource<<6b51c773a033cbe0a13726aa6cb41610>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type EvaluatorsTable_row$data = {
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

(node as any).hash = "b61ed610e06d39f7a2584bd03450c6bd";

export default node;
