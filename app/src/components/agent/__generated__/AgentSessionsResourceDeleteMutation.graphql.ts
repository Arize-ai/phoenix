/**
 * @generated SignedSource<<71bfbb71f6db09299379373f37f9025c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AgentSessionsResourceDeleteMutation$variables = {
  connectionId: string;
  sessionId: string;
};
export type AgentSessionsResourceDeleteMutation$data = {
  readonly deleteAgentSession: {
    readonly deletedAgentSessionId: string;
    readonly sessionId: string;
  };
};
export type AgentSessionsResourceDeleteMutation = {
  response: AgentSessionsResourceDeleteMutation$data;
  variables: AgentSessionsResourceDeleteMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sessionId"
},
v2 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "sessionId",
        "variableName": "sessionId"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "deletedAgentSessionId",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionId",
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
    "name": "AgentSessionsResourceDeleteMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DeleteAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "deleteAgentSession",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          (v4/*:: as any*/)
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
    "name": "AgentSessionsResourceDeleteMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DeleteAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "deleteAgentSession",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "deleteEdge",
            "key": "",
            "kind": "ScalarHandle",
            "name": "deletedAgentSessionId",
            "handleArgs": [
              {
                "items": [
                  {
                    "kind": "Variable",
                    "name": "connections.0",
                    "variableName": "connectionId"
                  }
                ],
                "kind": "ListValue",
                "name": "connections"
              }
            ]
          },
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2474f57342e3a6b8bc724d06dbe14334",
    "id": null,
    "metadata": {},
    "name": "AgentSessionsResourceDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation AgentSessionsResourceDeleteMutation(\n  $sessionId: String!\n) {\n  deleteAgentSession(input: {sessionId: $sessionId}) {\n    deletedAgentSessionId\n    sessionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "45bb194138c4eb95aa9b57ec8b30ea28";

export default node;
