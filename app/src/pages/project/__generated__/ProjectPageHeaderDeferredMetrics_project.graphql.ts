/**
 * @generated SignedSource<<b102eac721c7e09ebaa4c1ebe014906b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageHeaderDeferredMetrics_project$data = {
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
  readonly latencyMsP50: number | null;
  readonly latencyMsP99: number | null;
  readonly " $fragmentType": "ProjectPageHeaderDeferredMetrics_project";
};
export type ProjectPageHeaderDeferredMetrics_project$key = {
  readonly " $data"?: ProjectPageHeaderDeferredMetrics_project$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeaderDeferredMetrics_project">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
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
      "kind": "RootArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectPageHeaderDeferredMetrics_project",
  "selections": [
    {
      "alias": null,
      "args": [
        (v0/*: any*/)
      ],
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
          "selections": (v1/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "prompt",
          "plural": false,
          "selections": (v1/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "completion",
          "plural": false,
          "selections": (v1/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": "latencyMsP50",
      "args": [
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v0/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    },
    {
      "alias": "latencyMsP99",
      "args": [
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v0/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "b3d60164340481340c0b3bceff89f9b9";

export default node;
