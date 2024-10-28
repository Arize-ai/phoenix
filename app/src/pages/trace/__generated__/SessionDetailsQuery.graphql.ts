/**
 * @generated SignedSource<<09739022ca9b52d61d2eb5646d7e9906>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type SessionDetailsQuery$variables = {
  id: string;
};
export type SessionDetailsQuery$data = {
  readonly session: {
    readonly traces?: {
      readonly edges: ReadonlyArray<{
        readonly trace: {
          readonly rootSpan: {
            readonly input: {
              readonly value: string;
            } | null;
            readonly output: {
              readonly value: string;
            } | null;
          } | null;
        };
      }>;
    };
  };
};
export type SessionDetailsQuery = {
  response: SessionDetailsQuery$data;
  variables: SessionDetailsQuery$variables;
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
v2 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  }
],
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "TraceConnection",
      "kind": "LinkedField",
      "name": "traces",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "TraceEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "trace",
              "args": null,
              "concreteType": "Trace",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Span",
                  "kind": "LinkedField",
                  "name": "rootSpan",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "SpanIOValue",
                      "kind": "LinkedField",
                      "name": "input",
                      "plural": false,
                      "selections": (v2/*: any*/),
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "SpanIOValue",
                      "kind": "LinkedField",
                      "name": "output",
                      "plural": false,
                      "selections": (v2/*: any*/),
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectSession",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionDetailsQuery",
    "selections": [
      {
        "alias": "session",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
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
    "name": "SessionDetailsQuery",
    "selections": [
      {
        "alias": "session",
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
          (v3/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
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
    "cacheID": "8b29972b49439ce8942839cc38a0c5be",
    "id": null,
    "metadata": {},
    "name": "SessionDetailsQuery",
    "operationKind": "query",
    "text": "query SessionDetailsQuery(\n  $id: GlobalID!\n) {\n  session: node(id: $id) {\n    __typename\n    ... on ProjectSession {\n      traces {\n        edges {\n          trace: node {\n            rootSpan {\n              input {\n                value\n              }\n              output {\n                value\n              }\n            }\n          }\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e2fd415f62c6b3af00e449a4dc383959";

export default node;
