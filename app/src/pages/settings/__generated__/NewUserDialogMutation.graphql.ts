/**
 * @generated SignedSource<<3dd3ac394686b1d5f78d2704b8d4780e>>
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
      readonly email: string;
      readonly id: string;
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
    "cacheID": "a9bf3794a5355d9d0e0a3acebe7f3809",
    "id": null,
    "metadata": {},
    "name": "NewUserDialogMutation",
    "operationKind": "mutation",
    "text": "mutation NewUserDialogMutation(\n  $input: CreateUserInput!\n) {\n  createUser(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "97d1aefa41e8831e57b6bb0d1a078a7c";

export default node;
