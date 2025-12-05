/**
 * @generated SignedSource<<d77ad347583e09322852e1460b0d663d>>
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
  readonly promptVersion?: {
    readonly id: string;
    readonly isLatest: boolean;
  };
  readonly promptVersionTag?: {
    readonly id: string;
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

(node as any).hash = "c35448c24fb3e306aa8d09e016ec6128";

export default node;
