/**
 * @generated SignedSource<<1474e0267ac0492045316af1a379d56b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RunMetadataFooterQuery$variables = {
  includeAttributes: boolean;
  spanId: string;
};
export type RunMetadataFooterQuery$data = {
  readonly span: {
    readonly attributes?: string;
    readonly costSummary?: {
      readonly total: {
        readonly cost: number | null;
      };
    } | null;
    readonly id: string;
    readonly latencyMs?: number | null;
    readonly spanId?: string;
    readonly tokenCountTotal?: number | null;
    readonly trace?: {
      readonly id: string;
      readonly project: {
        readonly id: string;
      };
      readonly traceId: string;
    };
  };
};
export type RunMetadataFooterQuery = {
  response: RunMetadataFooterQuery$data;
  variables: RunMetadataFooterQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "includeAttributes"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "spanId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Trace",
      "kind": "LinkedField",
      "name": "trace",
      "plural": false,
      "selections": [
        (v3/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "traceId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "Project",
          "kind": "LinkedField",
          "name": "project",
          "plural": false,
          "selections": [
            (v3/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tokenCountTotal",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "latencyMs",
      "storageKey": null
    },
    {
      "condition": "includeAttributes",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "attributes",
          "storageKey": null
        }
      ]
    },
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
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cost",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "RunMetadataFooterQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          (v4/*:: as any*/)
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "RunMetadataFooterQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v2/*:: as any*/),
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
          (v3/*:: as any*/),
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e94c66883299bd43895a652d8cd2b699",
    "id": null,
    "metadata": {},
    "name": "RunMetadataFooterQuery",
    "operationKind": "query",
    "text": "query RunMetadataFooterQuery(\n  $spanId: ID!\n  $includeAttributes: Boolean!\n) {\n  span: node(id: $spanId) {\n    __typename\n    id\n    ... on Span {\n      spanId\n      trace {\n        id\n        traceId\n        project {\n          id\n        }\n      }\n      tokenCountTotal\n      latencyMs\n      attributes @include(if: $includeAttributes)\n      costSummary {\n        total {\n          cost\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8feebc84425bf4cfcb2d038b3a7d70ed";

export default node;
