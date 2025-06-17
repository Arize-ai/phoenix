/**
 * @generated SignedSource<<bd58788c6229152f93865bd594b8be0a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RunMetadataFooterQuery$variables = {
  spanId: string;
};
export type RunMetadataFooterQuery$data = {
  readonly span: {
    readonly cost?: {
      readonly total: number | null;
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
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
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
        (v2/*: any*/),
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
            (v2/*: any*/)
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
      "alias": null,
      "args": null,
      "concreteType": "TokenCost",
      "kind": "LinkedField",
      "name": "cost",
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
    }
  ],
  "type": "Span",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RunMetadataFooterQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/)
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
    "name": "RunMetadataFooterQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
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
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "eb2cd7af18e3109431f887c4f5a54e58",
    "id": null,
    "metadata": {},
    "name": "RunMetadataFooterQuery",
    "operationKind": "query",
    "text": "query RunMetadataFooterQuery(\n  $spanId: ID!\n) {\n  span: node(id: $spanId) {\n    __typename\n    id\n    ... on Span {\n      spanId\n      trace {\n        id\n        traceId\n        project {\n          id\n        }\n      }\n      tokenCountTotal\n      latencyMs\n      cost {\n        total\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7996cfea6120977c331bb4ec2b8142fb";

export default node;
