/**
 * @generated SignedSource<<43fb458ab321d5b9fd808be67fe0d0f3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AgentSessionLifecycleCreateMutation$variables = Record<PropertyKey, never>;
export type AgentSessionLifecycleCreateMutation$data = {
  readonly createAgentSession: {
    readonly agentSession: {
      readonly id: string;
    };
  };
};
export type AgentSessionLifecycleCreateMutation = {
  response: AgentSessionLifecycleCreateMutation$data;
  variables: AgentSessionLifecycleCreateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "AgentSessionMutationPayload",
    "kind": "LinkedField",
    "name": "createAgentSession",
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
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "AgentSessionLifecycleCreateMutation",
    "selections": (v0/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "AgentSessionLifecycleCreateMutation",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "ba061074b1ae87265e8819ce368bde73",
    "id": null,
    "metadata": {},
    "name": "AgentSessionLifecycleCreateMutation",
    "operationKind": "mutation",
    "text": "mutation AgentSessionLifecycleCreateMutation {\n  createAgentSession {\n    agentSession {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "63c88b0ddf0f39afe8f4e58086d762b6";

export default node;
