/**
 * @generated SignedSource<<9b9abc91849c857cfe99719ce799f3a0>>
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

(node as any).hash = "92c860db9a582b88333d39be427c79be";

export default node;
