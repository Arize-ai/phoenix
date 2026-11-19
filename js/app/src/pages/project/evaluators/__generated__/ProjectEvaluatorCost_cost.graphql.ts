/**
 * @generated SignedSource<<58946708fa03f58a93d22c5557ef8cd0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCost_cost$data = {
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
  } | null;
  readonly tracedEvaluationCount: number | null;
  readonly " $fragmentType": "ProjectEvaluatorCost_cost";
};
export type ProjectEvaluatorCost_cost$key = {
  readonly " $data"?: ProjectEvaluatorCost_cost$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCost_cost">;
};

const node: ReaderFragment = (function(){
var v0 = [
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v1 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorCost_cost",
  "selections": [
    {
      "alias": null,
      "args": (v0/*:: as any*/),
      "kind": "ScalarField",
      "name": "tracedEvaluationCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v0/*:: as any*/),
      "concreteType": "SpanCostSummary",
      "kind": "LinkedField",
      "name": "costSummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "total",
          "plural": false,
          "selections": (v1/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "prompt",
          "plural": false,
          "selections": (v1/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "completion",
          "plural": false,
          "selections": (v1/*:: as any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "15a238ecee0a2c6f2e4dcb7fde07112a";

export default node;
