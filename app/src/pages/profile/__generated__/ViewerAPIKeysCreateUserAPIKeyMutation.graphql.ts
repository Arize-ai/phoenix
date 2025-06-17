/**
 * @generated SignedSource<<6c55e1cb9ee2a5b82276c4bd5eeb1956>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateUserApiKeyInput = {
  description?: string | null;
  expiresAt?: string | null;
  name: string;
};
export type ViewerAPIKeysCreateUserAPIKeyMutation$variables = {
  input: CreateUserApiKeyInput;
};
export type ViewerAPIKeysCreateUserAPIKeyMutation$data = {
  readonly createUserApiKey: {
    readonly apiKey: {
      readonly id: string;
      readonly user: {
        readonly " $fragmentSpreads": FragmentRefs<"APIKeysTableFragment">;
      };
    };
    readonly jwt: string;
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"SystemAPIKeysTableFragment">;
    };
  };
};
export type ViewerAPIKeysCreateUserAPIKeyMutation = {
  response: ViewerAPIKeysCreateUserAPIKeyMutation$data;
  variables: ViewerAPIKeysCreateUserAPIKeyMutation$variables;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "jwt",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  (v3/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "description",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "createdAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "expiresAt",
    "storageKey": null
  }
],
v5 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "UserApiKey",
    "kind": "LinkedField",
    "name": "apiKeys",
    "plural": true,
    "selections": (v4/*: any*/),
    "storageKey": null
  },
  (v3/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ViewerAPIKeysCreateUserAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "CreateUserApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "createUserApiKey",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SystemAPIKeysTableFragment"
              }
            ],
            "storageKey": null
          },
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "UserApiKey",
            "kind": "LinkedField",
            "name": "apiKey",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "APIKeysTableFragment"
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
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ViewerAPIKeysCreateUserAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "CreateUserApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "createUserApiKey",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "SystemApiKey",
                "kind": "LinkedField",
                "name": "systemApiKeys",
                "plural": true,
                "selections": (v4/*: any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "viewer",
                "plural": false,
                "selections": (v5/*: any*/),
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "UserApiKey",
            "kind": "LinkedField",
            "name": "apiKey",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": (v5/*: any*/),
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4eb5c442aefb7ebcebccb8bc6720ad55",
    "id": null,
    "metadata": {},
    "name": "ViewerAPIKeysCreateUserAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation ViewerAPIKeysCreateUserAPIKeyMutation(\n  $input: CreateUserApiKeyInput!\n) {\n  createUserApiKey(input: $input) {\n    query {\n      ...SystemAPIKeysTableFragment\n    }\n    jwt\n    apiKey {\n      id\n      user {\n        ...APIKeysTableFragment\n        id\n      }\n    }\n  }\n}\n\nfragment APIKeysTableFragment on User {\n  apiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n  id\n}\n\nfragment SystemAPIKeysTableFragment on Query {\n  systemApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n  viewer {\n    ...APIKeysTableFragment\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "27931e89ef9d535a58331bfbdb56f4cb";

export default node;
