/**
 * @generated SignedSource<<c587fbc15bf8b6e5ea94a5c0ae11f58d>>
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

(node as any).hash = "d7eb38c8395f3fa9c19336af68fe90d5";

export default node;
