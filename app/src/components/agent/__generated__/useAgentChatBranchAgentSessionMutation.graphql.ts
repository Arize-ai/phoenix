/**
 * @generated SignedSource<<8649550a6d865d682ad46f03e187bc83>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type BranchAgentSessionInput = {
  id: string;
  messageId: string;
};
export type useAgentChatBranchAgentSessionMutation$variables = {
  connections: ReadonlyArray<string>;
  input: BranchAgentSessionInput;
};
export type useAgentChatBranchAgentSessionMutation$data = {
  readonly branchAgentSession: {
    readonly agentSession: {
      readonly createdAt: string;
      readonly id: string;
      readonly isTemporary: boolean;
      readonly messages: any;
      readonly title: string;
      readonly updatedAt: string;
    };
  };
};
export type useAgentChatBranchAgentSessionMutation = {
  response: useAgentChatBranchAgentSessionMutation$data;
  variables: useAgentChatBranchAgentSessionMutation$variables;
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
      "name": "title",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isTemporary",
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "messages",
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
    "name": "useAgentChatBranchAgentSessionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "BranchAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "branchAgentSession",
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
    "name": "useAgentChatBranchAgentSessionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "BranchAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "branchAgentSession",
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
    "cacheID": "9811c7cc58807b60e41478749d2a669f",
    "id": null,
    "metadata": {},
    "name": "useAgentChatBranchAgentSessionMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentChatBranchAgentSessionMutation(\n  $input: BranchAgentSessionInput!\n) {\n  branchAgentSession(input: $input) {\n    agentSession {\n      id\n      title\n      isTemporary\n      createdAt\n      updatedAt\n      messages\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "44cc64b49a8281576213c7eb73a58c2c";

export default node;
