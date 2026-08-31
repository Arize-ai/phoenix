/**
 * @generated SignedSource<<14cb1416a26c7dfd72b2549c019949b5>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsAgentSessionActionMenuDeleteMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  id: string;
};
export type SettingsAgentSessionActionMenuDeleteMutation$data = {
  readonly deleteAgentSession: {
    readonly deletedAgentSessionId: string;
  };
};
export type SettingsAgentSessionActionMenuDeleteMutation = {
  response: SettingsAgentSessionActionMenuDeleteMutation$data;
  variables: SettingsAgentSessionActionMenuDeleteMutation$variables;
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
    "name": "SettingsAgentSessionActionMenuDeleteMutation",
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
    "name": "SettingsAgentSessionActionMenuDeleteMutation",
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
    "cacheID": "80eca0948839e7c0ad1aa1ad235acfb2",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentSessionActionMenuDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAgentSessionActionMenuDeleteMutation(\n  $id: ID!\n) {\n  deleteAgentSession(input: {id: $id}) {\n    deletedAgentSessionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "f4a96034d7cf6ccd1984ae7bc7aa3f7e";

export default node;
