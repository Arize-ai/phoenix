/**
 * @generated SignedSource<<9fcd74be92bc662aa95368e0583837d5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type sessionPageContextByIdQuery$variables = {
  id: string;
};
export type sessionPageContextByIdQuery$data = {
  readonly node: {
    readonly __typename: "ProjectSession";
    readonly costSummary: {
      readonly completion: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
      readonly prompt: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly endTime: string;
    readonly id: string;
    readonly latencyP50: number | null;
    readonly numTraces: number;
    readonly sessionId: string;
    readonly startTime: string;
    readonly tokenUsage: {
      readonly total: number;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type sessionPageContextByIdQuery = {
  response: sessionPageContextByIdQuery$data;
  variables: sessionPageContextByIdQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionId",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numTraces",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "TokenUsage",
  "kind": "LinkedField",
  "name": "tokenUsage",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "total",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v9 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "tokens",
    "storageKey": null
  }
],
v10 = {
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
      "selections": (v9/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v9/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v9/*: any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v11 = {
  "alias": "latencyP50",
  "args": [
    {
      "kind": "Literal",
      "name": "probability",
      "value": 0.5
    }
  ],
  "kind": "ScalarField",
  "name": "traceLatencyMsQuantile",
  "storageKey": "traceLatencyMsQuantile(probability:0.5)"
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "sessionPageContextByIdQuery",
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
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/)
            ],
            "type": "ProjectSession",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "sessionPageContextByIdQuery",
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
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/)
            ],
            "type": "ProjectSession",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "44ae8795525d17fe611eb02d1702be25",
    "id": null,
    "metadata": {},
    "name": "sessionPageContextByIdQuery",
    "operationKind": "query",
    "text": "query sessionPageContextByIdQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on ProjectSession {\n      id\n      sessionId\n      startTime\n      endTime\n      numTraces\n      tokenUsage {\n        total\n      }\n      costSummary {\n        total {\n          cost\n          tokens\n        }\n        prompt {\n          cost\n          tokens\n        }\n        completion {\n          cost\n          tokens\n        }\n      }\n      latencyP50: traceLatencyMsQuantile(probability: 0.5)\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "1dc9aa924f0ae388d2c9ae134af669b9";

export default node;
