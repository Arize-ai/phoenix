/**
 * @generated SignedSource<<979ccf4d31127bcb5b0218baa53edbc4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AgentSessionsResourceSessionQuery$variables = {
  sessionId: string;
};
export type AgentSessionsResourceSessionQuery$data = {
  readonly agentSession: {
    readonly createdAt: string;
    readonly id: string;
    readonly messages: any;
    readonly title: string;
  } | null;
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
    "name": "sessionId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "sessionId",
        "variableName": "sessionId"
      }
    ],
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AgentSessionsResourceSessionQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "AgentSessionsResourceSessionQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "055af1941dec61c15fd60fdc7238ba63",
    "id": null,
    "metadata": {},
    "name": "AgentSessionsResourceSessionQuery",
    "operationKind": "query",
    "text": "query AgentSessionsResourceSessionQuery(\n  $sessionId: String!\n) {\n  agentSession(sessionId: $sessionId) {\n    id\n    title\n    createdAt\n    messages\n  }\n}\n"
  }
};
})();

(node as any).hash = "a5a88369d4035003ead891d8f70b03ba";

export default node;
