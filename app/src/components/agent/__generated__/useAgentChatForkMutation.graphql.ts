/**
 * @generated SignedSource<<06506db5ae28f4b3050ffdef02427117>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useAgentChatForkMutation$variables = {
  lastMessageId?: string | null;
  sourceSessionId: string;
};
export type useAgentChatForkMutation$data = {
  readonly forkAgentSession: {
    readonly agentSession: {
      readonly createdAt: string;
      readonly id: string;
      readonly messages: any;
      readonly title: string;
    };
  };
};
export type useAgentChatForkMutation = {
  response: useAgentChatForkMutation$data;
  variables: useAgentChatForkMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "lastMessageId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sourceSessionId"
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "lastMessageId",
            "variableName": "lastMessageId"
          },
          {
            "kind": "Variable",
            "name": "sourceSessionId",
            "variableName": "sourceSessionId"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "AgentSessionMutationPayload",
    "kind": "LinkedField",
    "name": "forkAgentSession",
    "plural": false,
    "selections": [
      {
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
            "name": "createdAt",
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
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useAgentChatForkMutation",
    "selections": (v2/*:: as any*/),
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
    "name": "useAgentChatForkMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "91f6922e36fe376ac0c6358d2094b99f",
    "id": null,
    "metadata": {},
    "name": "useAgentChatForkMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentChatForkMutation(\n  $sourceSessionId: ID!\n  $lastMessageId: String\n) {\n  forkAgentSession(input: {sourceSessionId: $sourceSessionId, lastMessageId: $lastMessageId}) {\n    agentSession {\n      id\n      title\n      createdAt\n      messages\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "bf273677bbcd829f2206727d7858f1cb";

export default node;
