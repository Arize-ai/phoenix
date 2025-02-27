/**
 * @generated SignedSource<<2eb320007e73f86ca096ae8d426f7b6c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type UserRoleInput = "ADMIN" | "MEMBER";
export type PatchUserInput = {
  newPassword?: string | null;
  newRole?: UserRoleInput | null;
  newUsername?: string | null;
  userId: string;
};
export type UserRoleChangeDialogMutation$variables = {
  input: PatchUserInput;
};
export type UserRoleChangeDialogMutation$data = {
  readonly patchUser: {
    readonly __typename: "UserMutationPayload";
  };
};
export type UserRoleChangeDialogMutation = {
  response: UserRoleChangeDialogMutation$data;
  variables: UserRoleChangeDialogMutation$variables;
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
    "concreteType": "UserMutationPayload",
    "kind": "LinkedField",
    "name": "patchUser",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
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
    "name": "UserRoleChangeDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UserRoleChangeDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "44e970c967f83a0b7a6bd1cbafc3a936",
    "id": null,
    "metadata": {},
    "name": "UserRoleChangeDialogMutation",
    "operationKind": "mutation",
    "text": "mutation UserRoleChangeDialogMutation(\n  $input: PatchUserInput!\n) {\n  patchUser(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "468eff05b42e39b55f9aa5b9a7d2c483";

export default node;
