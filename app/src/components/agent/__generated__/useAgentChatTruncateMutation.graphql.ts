/**
 * @generated SignedSource<<b162db06c2bf4fc253167e68c33b55ad>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useAgentChatTruncateMutation$variables = {
  id: string;
  lastMessageId?: string | null;
};
export type useAgentChatTruncateMutation$data = {
  readonly truncateAgentSession: {
    readonly agentSession: {
      readonly id: string;
      readonly messages: any;
      readonly updatedAt: string;
    };
  };
};
export type useAgentChatTruncateMutation = {
  response: useAgentChatTruncateMutation$data;
  variables: useAgentChatTruncateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "lastMessageId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "id",
            "variableName": "id"
          },
          {
            "kind": "Variable",
            "name": "lastMessageId",
            "variableName": "lastMessageId"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "AgentSessionMutationPayload",
    "kind": "LinkedField",
    "name": "truncateAgentSession",
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
            "name": "messages",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useAgentChatTruncateMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useAgentChatTruncateMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "4bc1a5253236806ff8671cff8f7adc3a",
    "id": null,
    "metadata": {},
    "name": "useAgentChatTruncateMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentChatTruncateMutation(\n  $id: ID!\n  $lastMessageId: String\n) {\n  truncateAgentSession(input: {id: $id, lastMessageId: $lastMessageId}) {\n    agentSession {\n      id\n      messages\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "acad0d918cc1a5974f30baf361e89277";

export default node;
