/**
 * @generated SignedSource<<5cd777211675cb1658e1b2fe0e688e70>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TruncateAgentSessionInput = {
  id: string;
  messageId: string;
};
export type useAgentChatTruncateAgentSessionMutation$variables = {
  input: TruncateAgentSessionInput;
};
export type useAgentChatTruncateAgentSessionMutation$data = {
  readonly truncateAgentSession: {
    readonly agentSession: {
      readonly compactionMessageId: string | null;
      readonly compactionSummary: string | null;
      readonly id: string;
      readonly messages: any;
      readonly title: string;
      readonly updatedAt: string;
    };
  };
};
export type useAgentChatTruncateAgentSessionMutation = {
  response: useAgentChatTruncateAgentSessionMutation$data;
  variables: useAgentChatTruncateAgentSessionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "TruncateAgentSessionMutationPayload",
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
            "name": "title",
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "compactionMessageId",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "compactionSummary",
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
    "name": "useAgentChatTruncateAgentSessionMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useAgentChatTruncateAgentSessionMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "86cb987192ed12fb93804f66f554054f",
    "id": null,
    "metadata": {},
    "name": "useAgentChatTruncateAgentSessionMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentChatTruncateAgentSessionMutation(\n  $input: TruncateAgentSessionInput!\n) {\n  truncateAgentSession(input: $input) {\n    agentSession {\n      id\n      title\n      updatedAt\n      messages\n      compactionMessageId\n      compactionSummary\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3f40a32b1a750d52585e626fa670441a";

export default node;
