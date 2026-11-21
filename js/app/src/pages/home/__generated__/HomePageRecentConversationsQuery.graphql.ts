/**
 * @generated SignedSource<<d90f2fd8f07a23b83cfef2e0b67cbabd>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type HomePageRecentConversationsQuery$variables = Record<PropertyKey, never>;
export type HomePageRecentConversationsQuery$data = {
  readonly agentSessions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly title: string;
        readonly updatedAt: string;
      };
    }>;
  };
};
export type HomePageRecentConversationsQuery = {
  response: HomePageRecentConversationsQuery$data;
  variables: HomePageRecentConversationsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Literal",
        "name": "first",
        "value": 5
      },
      {
        "kind": "Literal",
        "name": "viewerOnly",
        "value": true
      }
    ],
    "concreteType": "AgentSessionConnection",
    "kind": "LinkedField",
    "name": "agentSessions",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "AgentSessionEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "AgentSession",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "title",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "updatedAt",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "agentSessions(first:5,viewerOnly:true)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "HomePageRecentConversationsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "HomePageRecentConversationsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "294a4b63f714dbc3cd3ba16677b63b89",
    "id": null,
    "metadata": {},
    "name": "HomePageRecentConversationsQuery",
    "operationKind": "query",
    "text": "query HomePageRecentConversationsQuery {\n  agentSessions(first: 5, viewerOnly: true) {\n    edges {\n      node {\n        id\n        title\n        updatedAt\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1a70b16abf5aab3778510a803ba03297";

export default node;
