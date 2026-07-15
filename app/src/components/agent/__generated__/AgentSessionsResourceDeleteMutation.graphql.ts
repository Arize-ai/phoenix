/**
 * @generated SignedSource<<226a0e5bd764df32cf91562ad118b142>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AgentSessionsResourceDeleteMutation$variables = {
  connectionId: string;
  id: string;
};
export type AgentSessionsResourceDeleteMutation$data = {
  readonly deleteAgentSession: {
    readonly deletedAgentSessionId: string;
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
  "name": "id"
},
v2 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7da9790d8b5e404cec28169648a5bf4a",
    "id": null,
    "metadata": {},
    "name": "AgentSessionsResourceDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation AgentSessionsResourceDeleteMutation(\n  $id: ID!\n) {\n  deleteAgentSession(input: {id: $id}) {\n    deletedAgentSessionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "feedd8c5daf5d09b7162f9d4d4203231";

export default node;
