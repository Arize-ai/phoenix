/**
 * @generated SignedSource<<876eb6ef8caa271869f214cd10573434>>
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

(node as any).hash = "2a80dc1f316d5c7ffd9b1553c63a47ac";

export default node;
