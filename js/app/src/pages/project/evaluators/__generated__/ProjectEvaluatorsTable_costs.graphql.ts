/**
 * @generated SignedSource<<5891c170d451135ff8049d21c39e9716>>
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

(node as any).hash = "b4f76247c53c45132069955b2b9c8b28";

export default node;
