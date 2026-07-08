/**
 * @generated SignedSource<<b0107409f15ef7f37bf6fc73fb576b3d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useAgentServerSessionsDetailQuery$variables = {
  sessionId: string;
};
export type useAgentServerSessionsDetailQuery$data = {
  readonly agentSession: {
    readonly messages: any;
  } | null;
};
export type useAgentServerSessionsDetailQuery = {
  response: useAgentServerSessionsDetailQuery$data;
  variables: useAgentServerSessionsDetailQuery$variables;
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
    "kind": "Variable",
    "name": "sessionId",
    "variableName": "sessionId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messages",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useAgentServerSessionsDetailQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "AgentSession",
        "kind": "LinkedField",
        "name": "agentSession",
        "plural": false,
        "selections": [
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useAgentServerSessionsDetailQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "AgentSession",
        "kind": "LinkedField",
        "name": "agentSession",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "859fd3bbb4378d1f0846166b58a7d9e3",
    "id": null,
    "metadata": {},
    "name": "useAgentServerSessionsDetailQuery",
    "operationKind": "query",
    "text": "query useAgentServerSessionsDetailQuery(\n  $sessionId: String!\n) {\n  agentSession(sessionId: $sessionId) {\n    messages\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "bc572ca3b4c2d92b92bec2d654b90369";

export default node;
