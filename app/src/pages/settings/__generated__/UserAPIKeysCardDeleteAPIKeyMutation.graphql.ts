/**
 * @generated SignedSource<<6c38bf66fd19d194a2a97789bacd6a0a>>
 * @lightSyntaxTransform
 * @nogrep
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "UserAPIKeysCardDeleteAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "deleteUserApiKey",
        "plural": false,
        "selections": [
          (v2/*: any*/),
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
                "args": (v3/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v4/*: any*/)
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
    "name": "UserAPIKeysCardDeleteAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "deleteUserApiKey",
        "plural": false,
        "selections": [
          (v2/*: any*/),
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
                "args": (v3/*: any*/),
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
                  (v4/*: any*/),
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
