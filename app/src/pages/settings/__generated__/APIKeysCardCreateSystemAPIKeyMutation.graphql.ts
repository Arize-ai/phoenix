/**
 * @generated SignedSource<<32ba75198d3f443e68d46bbba4eaaebd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ApiKeyScope = "INGEST";
export type APIKeysCardCreateSystemAPIKeyMutation$variables = {
  description?: string | null;
  expiresAt?: string | null;
  name: string;
  scope?: ApiKeyScope | null;
};
export type APIKeysCardCreateSystemAPIKeyMutation$data = {
  readonly createSystemApiKey: {
    readonly apiKey: {
      readonly id: string;
    };
    readonly jwt: string;
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"SystemAPIKeysTableFragment">;
    };
  };
};
export type APIKeysCardCreateSystemAPIKeyMutation = {
  response: APIKeysCardCreateSystemAPIKeyMutation$data;
  variables: APIKeysCardCreateSystemAPIKeyMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "expiresAt"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scope"
},
v4 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "description",
        "variableName": "description"
      },
      {
        "kind": "Variable",
        "name": "expiresAt",
        "variableName": "expiresAt"
      },
      {
        "kind": "Variable",
        "name": "name",
        "variableName": "name"
      },
      {
        "kind": "Variable",
        "name": "scope",
        "variableName": "scope"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "jwt",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "SystemApiKey",
  "kind": "LinkedField",
  "name": "apiKey",
  "plural": false,
  "selections": [
    (v6/*: any*/)
  ],
  "storageKey": null
},
v8 = [
  (v6/*: any*/),
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
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "APIKeysCardCreateSystemAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
        "concreteType": "CreateSystemApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "createSystemApiKey",
        "plural": false,
        "selections": [
          (v5/*: any*/),
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
          (v7/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Operation",
    "name": "APIKeysCardCreateSystemAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
        "concreteType": "CreateSystemApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "createSystemApiKey",
        "plural": false,
        "selections": [
          (v5/*: any*/),
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
                "selections": (v8/*: any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "viewer",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "UserApiKey",
                    "kind": "LinkedField",
                    "name": "apiKeys",
                    "plural": true,
                    "selections": (v8/*: any*/),
                    "storageKey": null
                  },
                  (v6/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v7/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "53c33decc48d7d11d0264aceef7aba78",
    "id": null,
    "metadata": {},
    "name": "APIKeysCardCreateSystemAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation APIKeysCardCreateSystemAPIKeyMutation(\n  $name: String!\n  $description: String = null\n  $expiresAt: DateTime = null\n  $scope: ApiKeyScope = null\n) {\n  createSystemApiKey(input: {name: $name, description: $description, expiresAt: $expiresAt, scope: $scope}) {\n    jwt\n    query {\n      ...SystemAPIKeysTableFragment\n    }\n    apiKey {\n      id\n    }\n  }\n}\n\nfragment APIKeysTableFragment on User {\n  apiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n  id\n}\n\nfragment SystemAPIKeysTableFragment on Query {\n  systemApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n  viewer {\n    ...APIKeysTableFragment\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0da9861c8c75d11f13cf5336a2a91ccb";

export default node;
