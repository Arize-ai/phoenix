/**
 * @generated SignedSource<<0f00e8a917dff0a8df7c51f36bc2f92f>>
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
export type DeleteUserButtonMutation$variables = {
  input: DeleteUsersInput;
};
export type DeleteUserButtonMutation$data = {
  readonly deleteUsers: any | null;
};
export type DeleteUserButtonMutation = {
  response: DeleteUserButtonMutation$data;
  variables: DeleteUserButtonMutation$variables;
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
    "name": "DeleteUserButtonMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DeleteUserButtonMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "9c580e6fdf5c72a5b9bc1a11aa523b87",
    "id": null,
    "metadata": {},
    "name": "DeleteUserButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteUserButtonMutation(\n  $input: DeleteUsersInput!\n) {\n  deleteUsers(input: $input)\n}\n"
  }
};
})();

(node as any).hash = "7d9741f45b81bebe929c19f0378c17a0";

export default node;
