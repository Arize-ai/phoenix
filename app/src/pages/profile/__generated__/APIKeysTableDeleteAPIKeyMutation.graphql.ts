/**
 * @generated SignedSource<<1649555d3c8fbb8e67132fd53fdd3403>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeleteApiKeyInput = {
  id: string;
};
export type APIKeysTableDeleteAPIKeyMutation$variables = {
  input: DeleteApiKeyInput;
};
export type APIKeysTableDeleteAPIKeyMutation$data = {
  readonly deleteUserApiKey: {
    readonly query: {
      readonly viewer: {
        readonly " $fragmentSpreads": FragmentRefs<"APIKeysTableFragment">;
      } | null;
    };
  };
};
export type APIKeysTableDeleteAPIKeyMutation = {
  response: APIKeysTableDeleteAPIKeyMutation$data;
  variables: APIKeysTableDeleteAPIKeyMutation$variables;
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
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "APIKeysTableDeleteAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "deleteUserApiKey",
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
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "viewer",
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
    "name": "APIKeysTableDeleteAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteApiKeyMutationPayload",
        "kind": "LinkedField",
        "name": "deleteUserApiKey",
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
                    "selections": [
                      (v2/*: any*/),
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
                    "storageKey": null
                  },
                  (v2/*: any*/)
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
    "cacheID": "4bdd87573f4445b94a5d22dca4c9da3b",
    "id": null,
    "metadata": {},
    "name": "APIKeysTableDeleteAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation APIKeysTableDeleteAPIKeyMutation(\n  $input: DeleteApiKeyInput!\n) {\n  deleteUserApiKey(input: $input) {\n    query {\n      viewer {\n        ...APIKeysTableFragment\n        id\n      }\n    }\n  }\n}\n\nfragment APIKeysTableFragment on User {\n  apiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "8d26517ce1b7bca6482fbd3dcdd320e3";

export default node;
