/**
 * @generated SignedSource<<f8d6e11145493d95fa9108fa64a1509a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AgentSessionLifecycleDeleteMutation$variables = {
  id: string;
};
export type AgentSessionLifecycleDeleteMutation$data = {
  readonly deleteAgentSession: {
    readonly deletedAgentSessionId: string;
  };
};
export type AgentSessionLifecycleDeleteMutation = {
  response: AgentSessionLifecycleDeleteMutation$data;
  variables: AgentSessionLifecycleDeleteMutation$variables;
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
    "concreteType": "DeleteAgentSessionMutationPayload",
    "kind": "LinkedField",
    "name": "deleteAgentSession",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "deletedAgentSessionId",
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
    "name": "AgentSessionLifecycleDeleteMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "AgentSessionLifecycleDeleteMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "425cccc7e0bda8cc9556c403fac2c014",
    "id": null,
    "metadata": {},
    "name": "AgentSessionLifecycleDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation AgentSessionLifecycleDeleteMutation(\n  $id: ID!\n) {\n  deleteAgentSession(input: {id: $id}) {\n    deletedAgentSessionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "6613764df1702f31adba33e80f92669f";

export default node;
