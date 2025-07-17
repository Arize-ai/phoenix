/**
 * @generated SignedSource<<2e26b7d9f180c7bf4d9509b0828d7c65>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TraceHeaderQuery$variables = {
  id: string;
  traceId: string;
};
export type TraceHeaderQuery$data = {
  readonly project: {
    readonly trace?: {
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
      readonly latencyMs: number | null;
    } | null;
  };
};
export type TraceHeaderQuery = {
  response: TraceHeaderQuery$data;
  variables: TraceHeaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "traceId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "traceId",
    "variableName": "traceId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v5 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v6 = {
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
      "name": "prompt",
      "plural": false,
      "selections": (v5/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v5/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "total",
      "plural": false,
      "selections": (v5/*: any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TraceHeaderQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v4/*: any*/),
                  (v6/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "TraceHeaderQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v4/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v7/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4726dae0a3741b9999101b7d10f1f232",
    "id": null,
    "metadata": {},
    "name": "TraceHeaderQuery",
    "operationKind": "query",
    "text": "query TraceHeaderQuery(\n  $traceId: ID!\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      trace(traceId: $traceId) {\n        latencyMs\n        costSummary {\n          prompt {\n            cost\n          }\n          completion {\n            cost\n          }\n          total {\n            cost\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e5cdb3301b19eb3a3be04f0eb1c8d2aa";

export default node;
