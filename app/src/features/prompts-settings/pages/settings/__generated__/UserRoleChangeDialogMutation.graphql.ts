/**
 * @generated SignedSource<<914a32a95c229ec84884ba44e598f877>>
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
export type UserRoleChangeDialogMutation$variables = {
  input: PatchUserInput;
};
export type UserRoleChangeDialogMutation$data = {
  readonly patchUser: {
    readonly user: {
      readonly id: string;
      readonly role: {
        readonly id: string;
        readonly name: string;
      };
    };
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
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
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "user",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "UserRole",
            "kind": "LinkedField",
            "name": "role",
            "plural": false,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              }
            ],
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "UserRoleChangeDialogMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UserRoleChangeDialogMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "3c8547a2325c7e077c817ed32c43a051",
    "id": null,
    "metadata": {},
    "name": "UserRoleChangeDialogMutation",
    "operationKind": "mutation",
    "text": "mutation UserRoleChangeDialogMutation(\n  $input: PatchUserInput!\n) {\n  patchUser(input: $input) {\n    user {\n      id\n      role {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "81ae74aa52c4c2bcbe266d9adf18f725";

export default node;
