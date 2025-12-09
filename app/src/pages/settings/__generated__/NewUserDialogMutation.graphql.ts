/**
 * @generated SignedSource<<a36f022bd03fc05bffe429f2dfadd42c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AuthMethod = "LDAP" | "LOCAL" | "OAUTH2";
export type UserRoleInput = "ADMIN" | "MEMBER" | "VIEWER";
export type CreateUserInput = {
  authMethod?: AuthMethod | null;
  email: string;
  password?: string | null;
  role: UserRoleInput;
  sendWelcomeEmail?: boolean | null;
  username: string;
};
export type NewUserDialogMutation$variables = {
  input: CreateUserInput;
};
export type NewUserDialogMutation$data = {
  readonly createUser: {
    readonly user: {
      readonly email: string | null;
      readonly id: string;
      readonly username: string;
    };
  };
};
export type NewUserDialogMutation = {
  response: NewUserDialogMutation$data;
  variables: NewUserDialogMutation$variables;
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
    "name": "createUser",
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "email",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "username",
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
    "name": "NewUserDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewUserDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "e03311063b020f79a5ad0d89410dfc58",
    "id": null,
    "metadata": {},
    "name": "NewUserDialogMutation",
    "operationKind": "mutation",
    "text": "mutation NewUserDialogMutation(\n  $input: CreateUserInput!\n) {\n  createUser(input: $input) {\n    user {\n      id\n      email\n      username\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "30cd721c401096c03fd7587053f35a21";

export default node;
