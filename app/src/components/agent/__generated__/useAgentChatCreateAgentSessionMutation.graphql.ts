/**
 * @generated SignedSource<<301ff0eeb66f4cf76cf3895949022c45>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateAgentSessionInput = {
  title?: string;
};
export type useAgentChatCreateAgentSessionMutation$variables = {
  connections: ReadonlyArray<string>;
  input: CreateAgentSessionInput;
};
export type useAgentChatCreateAgentSessionMutation$data = {
  readonly createAgentSession: {
    readonly agentSession: {
      readonly createdAt: string;
      readonly id: string;
      readonly revision: number;
      readonly title: string;
      readonly updatedAt: string;
    };
  };
};
export type useAgentChatCreateAgentSessionMutation = {
  response: useAgentChatCreateAgentSessionMutation$data;
  variables: useAgentChatCreateAgentSessionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "AgentSession",
  "kind": "LinkedField",
  "name": "agentSession",
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
      "name": "revision",
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
      "name": "createdAt",
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
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useAgentChatCreateAgentSessionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "CreateAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "createAgentSession",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "useAgentChatCreateAgentSessionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "CreateAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "createAgentSession",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "agentSession",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "AgentSessionEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2bc9aec94b28a3ec3d16d5e5393bf68f",
    "id": null,
    "metadata": {},
    "name": "useAgentChatCreateAgentSessionMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentChatCreateAgentSessionMutation(\n  $input: CreateAgentSessionInput!\n) {\n  createAgentSession(input: $input) {\n    agentSession {\n      id\n      revision\n      title\n      createdAt\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d6e6ab99ce81e710bc75ada4555d5d7f";

export default node;
