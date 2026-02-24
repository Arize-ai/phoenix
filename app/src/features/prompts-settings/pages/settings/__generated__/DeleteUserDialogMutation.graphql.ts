/**
 * @generated SignedSource<<81f07fd13832e41474e2a3611fba7562>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteUsersInput = {
  userIds: ReadonlyArray<string>;
};
export type DeleteUserDialogMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  input: DeleteUsersInput;
};
export type DeleteUserDialogMutation$data = {
  readonly deleteUsers: {
    readonly userIds: ReadonlyArray<string>;
  };
};
export type DeleteUserDialogMutation = {
  response: DeleteUserDialogMutation$data;
  variables: DeleteUserDialogMutation$variables;
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
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "userIds",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DeleteUserDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DeleteUsersPayload",
        "kind": "LinkedField",
        "name": "deleteUsers",
        "plural": false,
        "selections": [
          (v3/*: any*/)
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
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "DeleteUserDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DeleteUsersPayload",
        "kind": "LinkedField",
        "name": "deleteUsers",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "deleteEdge",
            "key": "",
            "kind": "ScalarHandle",
            "name": "userIds",
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
    "cacheID": "6104e51eeaa0e88341d600b9c8f2272a",
    "id": null,
    "metadata": {},
    "name": "DeleteUserDialogMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteUserDialogMutation(\n  $input: DeleteUsersInput!\n) {\n  deleteUsers(input: $input) {\n    userIds\n  }\n}\n"
  }
};
})();

(node as any).hash = "3e3fce3704bc71d61dc41b274452060c";

export default node;
