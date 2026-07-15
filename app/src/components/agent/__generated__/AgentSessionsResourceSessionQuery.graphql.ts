/**
 * @generated SignedSource<<2bd59d53461e95cb0657c91d5b44b972>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AgentSessionsResourceSessionQuery$variables = {
  id: string;
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
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AgentSessionsResourceSessionQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "AgentSessionsResourceSessionQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "9ac32e91de6c43cf327a4776d38ccd69",
    "id": null,
    "metadata": {},
    "name": "AgentSessionsResourceSessionQuery",
    "operationKind": "query",
    "text": "query AgentSessionsResourceSessionQuery(\n  $id: ID!\n) {\n  agentSession(id: $id) {\n    id\n    title\n    createdAt\n    messages\n  }\n}\n"
  }
};
})();

(node as any).hash = "66ffd37f99696fb120ba6893ccb42325";

export default node;
