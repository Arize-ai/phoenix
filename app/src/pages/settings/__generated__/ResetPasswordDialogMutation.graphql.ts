/**
 * @generated SignedSource<<d025178cc0e4f95fc5538c511c7fad06>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UserRoleInput = "ADMIN" | "MEMBER" | "VIEWER";
export type PatchUserInput = {
  newPassword?: string | null;
  newRole?: UserRoleInput | null;
  newUsername?: string | null;
  userId: string;
};
export type ResetPasswordDialogMutation$variables = {
  input: PatchUserInput;
};
export type ResetPasswordDialogMutation$data = {
  readonly patchUser: {
    readonly __typename: "UserMutationPayload";
  };
};
export type ResetPasswordDialogMutation = {
  response: ResetPasswordDialogMutation$data;
  variables: ResetPasswordDialogMutation$variables;
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
    "name": "ResetPasswordDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ResetPasswordDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "6ccff8dd53d97eeb41f656bcd2758da1",
    "id": null,
    "metadata": {},
    "name": "ResetPasswordDialogMutation",
    "operationKind": "mutation",
    "text": "mutation ResetPasswordDialogMutation(\n  $input: PatchUserInput!\n) {\n  patchUser(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "85b22da61ec094c28e97db2759622b69";

export default node;
