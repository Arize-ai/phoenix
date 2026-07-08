/**
 * @generated SignedSource<<d77302f3612eb79c3c4a780683b90a57>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useAgentServerSessionsDeleteMutation$variables = {
  sessionId: string;
};
export type useAgentServerSessionsDeleteMutation$data = {
  readonly deleteAgentSession: {
    readonly sessionId: string;
  };
};
export type useAgentServerSessionsDeleteMutation = {
  response: useAgentServerSessionsDeleteMutation$data;
  variables: useAgentServerSessionsDeleteMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "sessionId"
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
            "name": "sessionId",
            "variableName": "sessionId"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "DeleteAgentSessionMutationPayload",
    "kind": "LinkedField",
    "name": "deleteAgentSession",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "sessionId",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useAgentServerSessionsDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useAgentServerSessionsDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "0548debed9b1af995df15a727fc6f858",
    "id": null,
    "metadata": {},
    "name": "useAgentServerSessionsDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentServerSessionsDeleteMutation(\n  $sessionId: String!\n) {\n  deleteAgentSession(input: {sessionId: $sessionId}) {\n    sessionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "46a0396c7a7bf7c87f8dd78c3897b79f";

export default node;
