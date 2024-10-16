/**
 * @generated SignedSource<<5fa2c9e899d0fc2d6e37f1f7a047e870>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type DeleteUsersInput = {
  userIds: ReadonlyArray<string>;
};
export type DeleteUserDialogMutation$variables = {
  input: DeleteUsersInput;
};
export type DeleteUserDialogMutation$data = {
  readonly deleteUsers: any | null;
};
export type DeleteUserDialogMutation = {
  response: DeleteUserDialogMutation$data;
  variables: DeleteUserDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "kind": "ScalarField",
    "name": "deleteUsers",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DeleteUserDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DeleteUserDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "00d3d0f3855e92e529bc446d0f426123",
    "id": null,
    "metadata": {},
    "name": "DeleteUserDialogMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteUserDialogMutation(\n  $input: DeleteUsersInput!\n) {\n  deleteUsers(input: $input)\n}\n"
  }
};
})();

(node as any).hash = "a718ceab0ec0a7d461f6cd5e5b178a1f";

export default node;
