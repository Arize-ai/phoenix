/**
 * @generated SignedSource<<1229b4d10bf54c241fc11b391aff79ad>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type LoginPageMutation$variables = {
  email: string;
  password: string;
};
export type LoginPageMutation$data = {
  readonly login: {
    readonly success: boolean;
  };
};
export type LoginPageMutation = {
  response: LoginPageMutation$data;
  variables: LoginPageMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "email"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "password"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "email",
            "variableName": "email"
          },
          {
            "kind": "Variable",
            "name": "password",
            "variableName": "password"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "AuthMutationPayload",
    "kind": "LinkedField",
    "name": "login",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "success",
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
    "name": "LoginPageMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "LoginPageMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "b08a0dc2136d520f45acb33299cc3df5",
    "id": null,
    "metadata": {},
    "name": "LoginPageMutation",
    "operationKind": "mutation",
    "text": "mutation LoginPageMutation(\n  $email: String!\n  $password: String!\n) {\n  login(input: {email: $email, password: $password}) {\n    success\n  }\n}\n"
  }
};
})();

(node as any).hash = "9437a4f8cdbea7f502f565931737bf81";

export default node;
