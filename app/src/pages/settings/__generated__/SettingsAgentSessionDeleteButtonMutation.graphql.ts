/**
 * @generated SignedSource<<051dd67472feffcb125232c5ab39636b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsAgentSessionDeleteButtonMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  id: string;
};
export type SettingsAgentSessionDeleteButtonMutation$data = {
  readonly deleteAgentSession: {
    readonly deletedAgentSessionId: string;
  };
};
export type SettingsAgentSessionDeleteButtonMutation = {
  response: SettingsAgentSessionDeleteButtonMutation$data;
  variables: SettingsAgentSessionDeleteButtonMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionIds"
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
    "name": "SettingsAgentSessionDeleteButtonMutation",
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
    "name": "SettingsAgentSessionDeleteButtonMutation",
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
                "kind": "Variable",
                "name": "connections",
                "variableName": "connectionIds"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "cc70a6a6f9058c995fb6c115acb7aefc",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentSessionDeleteButtonMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAgentSessionDeleteButtonMutation(\n  $id: ID!\n) {\n  deleteAgentSession(input: {id: $id}) {\n    deletedAgentSessionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "a9fd01482eb8d068c586ff57d8638fbb";

export default node;
