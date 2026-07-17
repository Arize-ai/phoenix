/**
 * @generated SignedSource<<428fbb2a6fd7782616bac87fc5497bc0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AgentSessionsResourceSessionQuery$variables = {
  id: string;
};
export type AgentSessionsResourceSessionQuery$data = {
  readonly agentSession: {
    readonly __typename: "AgentSession";
    readonly createdAt: string;
    readonly id: string;
    readonly messages: any;
    readonly title: string;
    readonly updatedAt: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type AgentSessionsResourceSessionQuery = {
  response: AgentSessionsResourceSessionQuery$data;
  variables: AgentSessionsResourceSessionQuery$variables;
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
  "name": "title",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messages",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AgentSessionsResourceSessionQuery",
    "selections": [
      {
        "alias": "agentSession",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/)
            ],
            "type": "AgentSession",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "AgentSessionsResourceSessionQuery",
    "selections": [
      {
        "alias": "agentSession",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/)
            ],
            "type": "AgentSession",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "329efd1a4f896580a29db9a1fa39144b",
    "id": null,
    "metadata": {},
    "name": "AgentSessionsResourceSessionQuery",
    "operationKind": "query",
    "text": "query AgentSessionsResourceSessionQuery(\n  $id: ID!\n) {\n  agentSession: node(id: $id) {\n    __typename\n    ... on AgentSession {\n      id\n      title\n      createdAt\n      updatedAt\n      messages\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "bcb9380edeaa7d4b395afca80d2545e3";

export default node;
