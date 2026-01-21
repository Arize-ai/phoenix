/**
 * @generated SignedSource<<c7ebf9e1d00fcb87a89aaa411f227050>>
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
    readonly isBuiltin: boolean;
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

(node as any).hash = "a6a630b3efa1afd319b1bbf051130735";

export default node;
