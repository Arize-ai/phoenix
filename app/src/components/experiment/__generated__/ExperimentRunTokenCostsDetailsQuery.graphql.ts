/**
 * @generated SignedSource<<801d2ff3a47a185e9fa620adea135193>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentRunTokenCostsDetailsQuery$variables = {
  nodeId: string;
};
export type ExperimentRunTokenCostsDetailsQuery$data = {
  readonly node: {
    readonly __typename: "ExperimentRun";
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
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type ExperimentRunTokenCostsDetailsQuery = {
  response: ExperimentRunTokenCostsDetailsQuery$data;
  variables: ExperimentRunTokenCostsDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "nodeId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "nodeId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
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
          "selections": (v3/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "prompt",
          "plural": false,
          "selections": (v3/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "completion",
          "plural": false,
          "selections": (v3/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ExperimentRun",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentRunTokenCostsDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExperimentRunTokenCostsDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v4/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "56ebff6ade8d9718931af681ea77b06a",
    "id": null,
    "metadata": {},
    "name": "ExperimentRunTokenCostsDetailsQuery",
    "operationKind": "query",
    "text": "query ExperimentRunTokenCostsDetailsQuery(\n  $nodeId: ID!\n) {\n  node(id: $nodeId) {\n    __typename\n    ... on ExperimentRun {\n      costSummary {\n        total {\n          cost\n        }\n        prompt {\n          cost\n        }\n        completion {\n          cost\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f99884bcc09d854081aeba2247d70dde";

export default node;
