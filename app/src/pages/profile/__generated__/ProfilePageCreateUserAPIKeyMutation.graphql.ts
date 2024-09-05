/**
 * @generated SignedSource<<556b8c089bb37db7811dab26537df3b6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateUserApiKeyInput = {
  description?: string | null;
  expiresAt?: string | null;
  name: string;
};
export type ProfilePageCreateUserAPIKeyMutation$variables = {
  input: CreateUserApiKeyInput;
};
export type ProfilePageCreateUserAPIKeyMutation$data = {
  readonly createUserApiKey: {
    readonly apiKey: {
      readonly id: string;
      readonly user: {
        readonly " $fragmentSpreads": FragmentRefs<"APIKeysTableFragment">;
      };
    };
    readonly jwt: string;
  };
};
export type ProfilePageCreateUserAPIKeyMutation = {
  response: ProfilePageCreateUserAPIKeyMutation$data;
  variables: ProfilePageCreateUserAPIKeyMutation$variables;
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProfilePageCreateUserAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "CreateUserApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "createUserApiKey",
        "plural": false,
        "selections": [
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
    "name": "ProfilePageCreateUserAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "CreateUserApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "createUserApiKey",
        "plural": false,
        "selections": [
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
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "apiKeys",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "__typename",
                        "storageKey": null
                      },
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
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v3/*: any*/)
                        ],
                        "type": "Node",
                        "abstractKey": "__isNode"
                      }
                    ],
                    "storageKey": null
                  },
                  (v3/*: any*/)
                ],
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
    "cacheID": "9a38e293fc466440bab0a84837c13d47",
    "id": null,
    "metadata": {},
    "name": "ProfilePageCreateUserAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation ProfilePageCreateUserAPIKeyMutation(\n  $input: CreateUserApiKeyInput!\n) {\n  createUserApiKey(input: $input) {\n    jwt\n    apiKey {\n      id\n      user {\n        ...APIKeysTableFragment\n      }\n    }\n  }\n}\n\nfragment APIKeysTableFragment on User {\n  apiKeys {\n    __typename\n    name\n    description\n    createdAt\n    expiresAt\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "27a71f1115779c67ec0b524fb7ef4e6c";

export default node;
