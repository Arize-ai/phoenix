/**
 * @generated SignedSource<<3d7bebe06fdfa73ab511c59f68919440>>
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
  readonly isAssignedToDataset: boolean;
  readonly kind: EvaluatorKind;
  readonly name: string;
  readonly pinnedPromptVersionId?: string | null;
  readonly prompt?: {
    readonly id: string;
    readonly name: string;
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

(node as any).hash = "a892eda8675b7d824ee6126ff1ef9a12";

export default node;
