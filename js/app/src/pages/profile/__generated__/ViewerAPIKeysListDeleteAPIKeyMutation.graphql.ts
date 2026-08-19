/**
 * @generated SignedSource<<a4dcca388f0826ef09aa96d4a6bbbc12>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeleteApiKeyInput = {
  id: string;
};
export type ViewerAPIKeysListDeleteAPIKeyMutation$variables = {
  input: DeleteApiKeyInput;
};
export type ViewerAPIKeysListDeleteAPIKeyMutation$data = {
  readonly deleteUserApiKey: {
    readonly query: {
      readonly viewer: {
        readonly " $fragmentSpreads": FragmentRefs<"ViewerAPIKeysListFragment">;
      } | null;
    };
  };
};
export type ViewerAPIKeysListDeleteAPIKeyMutation = {
  response: ViewerAPIKeysListDeleteAPIKeyMutation$data;
  variables: ViewerAPIKeysListDeleteAPIKeyMutation$variables;
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ViewerAPIKeysListDeleteAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
                    "name": "ViewerAPIKeysListFragment"
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ViewerAPIKeysListDeleteAPIKeyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
                      (v2/*:: as any*/),
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
                  (v2/*:: as any*/)
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
    "cacheID": "42bf66fb80d565913b8583e13318e83d",
    "id": null,
    "metadata": {},
    "name": "ViewerAPIKeysListDeleteAPIKeyMutation",
    "operationKind": "mutation",
    "text": "mutation ViewerAPIKeysListDeleteAPIKeyMutation(\n  $input: DeleteApiKeyInput!\n) {\n  deleteUserApiKey(input: $input) {\n    query {\n      viewer {\n        ...ViewerAPIKeysListFragment\n        id\n      }\n    }\n  }\n}\n\nfragment ViewerAPIKeysListFragment on User {\n  apiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "ea1311a5baac4dc68f6e6f7a6b3e5151";

export default node;
