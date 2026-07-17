/**
 * @generated SignedSource<<6ebc5162bb62f9c0b1b9fde3994f8e32>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteApiKeyInput = {
  id: string;
};
export type UserAPIKeysCardDeleteAPIKeyMutation$variables = {
  input: DeleteApiKeyInput;
  userId: string;
};
export type UserAPIKeysCardDeleteAPIKeyMutation$data = {
  readonly deleteUserApiKey: {
    readonly apiKeyId: string;
    readonly query: {
      readonly node: {
        readonly apiKeyCount?: number;
      };
    };
  };
};
export type UserAPIKeysCardDeleteAPIKeyMutation = {
  response: UserAPIKeysCardDeleteAPIKeyMutation$data;
  variables: UserAPIKeysCardDeleteAPIKeyMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "userId"
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
  "name": "apiKeyId",
  "storageKey": null
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "userId"
  }
],
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "apiKeyCount",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "UserAPIKeysCardDeleteAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DeleteApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "deleteUserApiKey",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
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
                "args": (v3/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v4/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "UserAPIKeysCardDeleteAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DeleteApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "deleteUserApiKey",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
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
                "args": (v3/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  (v4/*:: as any*/),
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
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "02008433fd537339f73b275e10a2c170",
    "id": null,
    "metadata": {},
    "name": "UserAPIKeysCardDeleteAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation UserAPIKeysCardDeleteAPIKeyMutation(\n  $input: DeleteApiKeyInput!\n  $userId: ID!\n) {\n  deleteUserApiKey(input: $input) {\n    apiKeyId\n    query {\n      node(id: $userId) {\n        __typename\n        ... on User {\n          apiKeyCount\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cc6842b672f487a394c06158d2aa01ec";

export default node;
