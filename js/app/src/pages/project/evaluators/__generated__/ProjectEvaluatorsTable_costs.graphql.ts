/**
 * @generated SignedSource<<d36769a10cd4f9d7d1f04de514e221f8>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_costs$data = {
  readonly traceProject: {
    readonly costSummary: {
      readonly completion: {
        readonly cost: number | null;
      };
      readonly prompt: {
        readonly cost: number | null;
      };
      readonly total: {
        readonly cost: number | null;
      };
    };
    readonly id: string;
    readonly traceCount: number;
  };
  readonly " $fragmentType": "ProjectEvaluatorsTable_costs";
};
export type ProjectEvaluatorsTable_costs$key = {
  readonly " $data"?: ProjectEvaluatorsTable_costs$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_costs">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ProjectEvaluatorsTable_costs"
};

(node as any).hash = "57bd9d89da679c070565b6e63ea14de2";

export default node;
