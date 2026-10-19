/**
 * @generated SignedSource<<c2bc75b7e1610120c3a3e474f5eca050>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsAIProvidersPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsAIProvidersPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"CustomProvidersCard_data" | "GenerativeProvidersCard_data">;
};
export type settingsAIProvidersPageLoaderQuery = {
  response: settingsAIProvidersPageLoaderQuery$data;
  variables: settingsAIProvidersPageLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "settingsAIProvidersPageLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "GenerativeProvidersCard_data"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "CustomProvidersCard_data"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "settingsAIProvidersPageLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "GenerativeProvider",
        "kind": "LinkedField",
        "name": "modelProviders",
        "plural": true,
        "selections": [
          (v0/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "key",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "dependenciesInstalled",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "dependencies",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "GenerativeProviderCredentialConfig",
            "kind": "LinkedField",
            "name": "credentialRequirements",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "envVarName",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "isRequired",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "credentialsSet",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "modelTypes",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "GenerativeModelCustomProviderConnection",
        "kind": "LinkedField",
        "name": "generativeModelCustomProviders",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "GenerativeModelCustomProviderEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "GenerativeModelCustomProvider",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v0/*:: as any*/),
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
                    "name": "sdk",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "provider",
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
                    "name": "updatedAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v2/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "username",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "profilePictureUrl",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "config",
                    "plural": false,
                    "selections": [
                      (v3/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "parseError",
                            "storageKey": null
                          }
                        ],
                        "type": "UnparsableConfig",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endCursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "generativeModelCustomProviders(first:50)"
      },
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "filters": null,
        "handle": "connection",
        "key": "CustomProvidersCard_generativeModelCustomProviders",
        "kind": "LinkedHandle",
        "name": "generativeModelCustomProviders"
      }
    ]
  },
  "params": {
    "cacheID": "873dcb76fd591a7f46eacb4c33f13408",
    "id": null,
    "metadata": {},
    "name": "settingsAIProvidersPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsAIProvidersPageLoaderQuery {\n  ...GenerativeProvidersCard_data\n  ...CustomProvidersCard_data\n}\n\nfragment CustomProvidersCard_data on Query {\n  generativeModelCustomProviders(first: 50) {\n    edges {\n      node {\n        id\n        name\n        description\n        sdk\n        provider\n        createdAt\n        updatedAt\n        user {\n          id\n          username\n          profilePictureUrl\n        }\n        config {\n          __typename\n          ... on UnparsableConfig {\n            parseError\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment GenerativeProvidersCard_data on Query {\n  modelProviders {\n    name\n    key\n    dependenciesInstalled\n    dependencies\n    credentialRequirements {\n      envVarName\n      isRequired\n    }\n    credentialsSet\n    modelTypes\n  }\n}\n"
  }
};
})();

(node as any).hash = "480ff9961e735c79794424188a494c9b";

export default node;
