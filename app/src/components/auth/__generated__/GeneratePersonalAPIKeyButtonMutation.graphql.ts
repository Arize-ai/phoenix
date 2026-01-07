/**
 * @generated SignedSource<<ee9f7b5c87995aade65d4fe2eca2e466>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateUserApiKeyInput = {
  description?: string | null;
  expiresAt?: string | null;
  name: string;
};
export type GeneratePersonalAPIKeyButtonMutation$variables = {
  input: CreateUserApiKeyInput;
};
export type GeneratePersonalAPIKeyButtonMutation$data = {
  readonly createUserApiKey: {
    readonly apiKey: {
      readonly id: string;
    };
    readonly jwt: string;
  };
};
export type GeneratePersonalAPIKeyButtonMutation = {
  response: GeneratePersonalAPIKeyButtonMutation$data;
  variables: GeneratePersonalAPIKeyButtonMutation$variables;
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
    "concreteType": "CreateUserApiKeyMutationPayload",
    "kind": "LinkedField",
    "name": "createUserApiKey",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "jwt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "UserApiKey",
        "kind": "LinkedField",
        "name": "apiKey",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
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
    "name": "GeneratePersonalAPIKeyButtonMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "GeneratePersonalAPIKeyButtonMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ab1efbf3367063e9ca4ca6164ad57049",
    "id": null,
    "metadata": {},
    "name": "GeneratePersonalAPIKeyButtonMutation",
    "operationKind": "mutation",
    "text": "mutation GeneratePersonalAPIKeyButtonMutation(\n  $input: CreateUserApiKeyInput!\n) {\n  createUserApiKey(input: $input) {\n    jwt\n    apiKey {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cab8091abb5961321e069ebd0756d2e3";

export default node;
