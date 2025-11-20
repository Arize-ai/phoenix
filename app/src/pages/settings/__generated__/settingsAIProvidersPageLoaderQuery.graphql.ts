/**
 * @generated SignedSource<<920d21701a9aba4f999a18b17da4802d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsAIProvidersPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsAIProvidersPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"CustomProvidersCard_data" | "GenerativeProvidersCard_data" | "SecretsCard_data">;
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "key",
  "storageKey": null
},
v2 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
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
},
v6 = [
  (v3/*: any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "stringValue",
        "storageKey": null
      }
    ],
    "type": "StringValue",
    "abstractKey": null
  },
  {
    "kind": "InlineFragment",
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "stringValueLookupKey",
        "storageKey": null
      }
    ],
    "type": "StringValueLookup",
    "abstractKey": null
  }
],
v7 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "apiKey",
  "plural": false,
  "selections": (v6/*: any*/),
  "storageKey": null
},
v8 = [
  (v7/*: any*/)
],
v9 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "baseUrl",
  "plural": false,
  "selections": (v6/*: any*/),
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultHeaders",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "OpenAIClientKwargs",
  "kind": "LinkedField",
  "name": "openaiClientKwargs",
  "plural": false,
  "selections": [
    (v9/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "organization",
      "plural": false,
      "selections": (v6/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": (v6/*: any*/),
      "storageKey": null
    },
    (v10/*: any*/)
  ],
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v13 = {
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
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "SecretsCard_data"
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
          (v0/*: any*/),
          (v1/*: any*/),
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
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v2/*: any*/),
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
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v0/*: any*/),
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
                      (v4/*: any*/),
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
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "config",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v5/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "OpenAIAuthenticationMethod",
                                "kind": "LinkedField",
                                "name": "openaiAuthenticationMethod",
                                "plural": false,
                                "selections": (v8/*: any*/),
                                "storageKey": null
                              },
                              (v11/*: any*/)
                            ],
                            "type": "OpenAICustomProviderConfig",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "GenerativeModelCustomProviderOpenAI",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "config",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v5/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "AzureOpenAIAuthenticationMethod",
                                "kind": "LinkedField",
                                "name": "azureOpenaiAuthenticationMethod",
                                "plural": false,
                                "selections": [
                                  (v7/*: any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "azureAdToken",
                                    "plural": false,
                                    "selections": (v6/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "AzureADTokenProvider",
                                    "kind": "LinkedField",
                                    "name": "azureAdTokenProvider",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "azureTenantId",
                                        "plural": false,
                                        "selections": (v6/*: any*/),
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "azureClientId",
                                        "plural": false,
                                        "selections": (v6/*: any*/),
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "azureClientSecret",
                                        "plural": false,
                                        "selections": (v6/*: any*/),
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "scope",
                                        "plural": false,
                                        "selections": (v6/*: any*/),
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "AzureOpenAIClientKwargs",
                                "kind": "LinkedField",
                                "name": "azureOpenaiClientKwargs",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "apiVersion",
                                    "plural": false,
                                    "selections": (v6/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "azureEndpoint",
                                    "plural": false,
                                    "selections": (v6/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "azureDeployment",
                                    "plural": false,
                                    "selections": (v6/*: any*/),
                                    "storageKey": null
                                  },
                                  (v10/*: any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "AzureOpenAICustomProviderConfig",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "GenerativeModelCustomProviderAzureOpenAI",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "config",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v5/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "AnthropicAuthenticationMethod",
                                "kind": "LinkedField",
                                "name": "anthropicAuthenticationMethod",
                                "plural": false,
                                "selections": (v8/*: any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "AnthropicClientKwargs",
                                "kind": "LinkedField",
                                "name": "anthropicClientKwargs",
                                "plural": false,
                                "selections": [
                                  (v9/*: any*/),
                                  (v10/*: any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "AnthropicCustomProviderConfig",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "GenerativeModelCustomProviderAnthropic",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "config",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v5/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "AWSBedrockAuthenticationMethod",
                                "kind": "LinkedField",
                                "name": "awsBedrockAuthenticationMethod",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "awsAccessKeyId",
                                    "plural": false,
                                    "selections": (v6/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "awsSecretAccessKey",
                                    "plural": false,
                                    "selections": (v6/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "awsSessionToken",
                                    "plural": false,
                                    "selections": (v6/*: any*/),
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "AWSBedrockClientKwargs",
                                "kind": "LinkedField",
                                "name": "awsBedrockClientKwargs",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "regionName",
                                    "plural": false,
                                    "selections": (v6/*: any*/),
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "AWSBedrockCustomProviderConfig",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "GenerativeModelCustomProviderAWSBedrock",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "config",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v5/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "GoogleGenAIAuthenticationMethod",
                                "kind": "LinkedField",
                                "name": "googleGenaiAuthenticationMethod",
                                "plural": false,
                                "selections": (v8/*: any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "GoogleGenAIClientKwargs",
                                "kind": "LinkedField",
                                "name": "googleGenaiClientKwargs",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "GoogleGenAIHttpOptions",
                                    "kind": "LinkedField",
                                    "name": "httpOptions",
                                    "plural": false,
                                    "selections": [
                                      (v9/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "headers",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "GoogleGenAICustomProviderConfig",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "GenerativeModelCustomProviderGoogleGenAI",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "config",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v5/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "DeepSeekAuthenticationMethod",
                                "kind": "LinkedField",
                                "name": "deepseekAuthenticationMethod",
                                "plural": false,
                                "selections": (v8/*: any*/),
                                "storageKey": null
                              },
                              (v11/*: any*/)
                            ],
                            "type": "DeepSeekCustomProviderConfig",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "GenerativeModelCustomProviderDeepSeek",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "config",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v5/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v11/*: any*/)
                            ],
                            "type": "OllamaCustomProviderConfig",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "GenerativeModelCustomProviderOllama",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "config",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v5/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "XAIAuthenticationMethod",
                                "kind": "LinkedField",
                                "name": "xaiAuthenticationMethod",
                                "plural": false,
                                "selections": (v8/*: any*/),
                                "storageKey": null
                              },
                              (v11/*: any*/)
                            ],
                            "type": "XAICustomProviderConfig",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "GenerativeModelCustomProviderXAI",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              },
              (v12/*: any*/)
            ],
            "storageKey": null
          },
          (v13/*: any*/)
        ],
        "storageKey": "generativeModelCustomProviders(first:50)"
      },
      {
        "alias": null,
        "args": (v2/*: any*/),
        "filters": null,
        "handle": "connection",
        "key": "CustomProvidersCard_generativeModelCustomProviders",
        "kind": "LinkedHandle",
        "name": "generativeModelCustomProviders"
      },
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "SecretConnection",
        "kind": "LinkedField",
        "name": "secrets",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "SecretEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Secret",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v4/*: any*/),
                  (v1/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "value",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "shadowsEnvironmentVariable",
                    "storageKey": null
                  },
                  (v3/*: any*/)
                ],
                "storageKey": null
              },
              (v12/*: any*/)
            ],
            "storageKey": null
          },
          (v13/*: any*/)
        ],
        "storageKey": "secrets(first:50)"
      },
      {
        "alias": null,
        "args": (v2/*: any*/),
        "filters": null,
        "handle": "connection",
        "key": "SecretsCard_secrets",
        "kind": "LinkedHandle",
        "name": "secrets"
      }
    ]
  },
  "params": {
    "cacheID": "d08577a1b8052eab0fd98fbbe9727d7b",
    "id": null,
    "metadata": {},
    "name": "settingsAIProvidersPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsAIProvidersPageLoaderQuery {\n  ...GenerativeProvidersCard_data\n  ...CustomProvidersCard_data\n  ...SecretsCard_data\n}\n\nfragment CustomProvidersCard_data on Query {\n  generativeModelCustomProviders(first: 50) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        description\n        sdk\n        provider\n        createdAt\n        updatedAt\n        user {\n          id\n          username\n          profilePictureUrl\n        }\n        ... on GenerativeModelCustomProviderOpenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on OpenAICustomProviderConfig {\n              openaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAzureOpenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on AzureOpenAICustomProviderConfig {\n              azureOpenaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureAdToken {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureAdTokenProvider {\n                  azureTenantId {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  azureClientId {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  azureClientSecret {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  scope {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                }\n              }\n              azureOpenaiClientKwargs {\n                apiVersion {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureEndpoint {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureDeployment {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAnthropic {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on AnthropicCustomProviderConfig {\n              anthropicAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              anthropicClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAWSBedrock {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on AWSBedrockCustomProviderConfig {\n              awsBedrockAuthenticationMethod {\n                awsAccessKeyId {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                awsSecretAccessKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                awsSessionToken {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              awsBedrockClientKwargs {\n                regionName {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderGoogleGenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on GoogleGenAICustomProviderConfig {\n              googleGenaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              googleGenaiClientKwargs {\n                httpOptions {\n                  baseUrl {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  headers\n                }\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderDeepSeek {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on DeepSeekCustomProviderConfig {\n              deepseekAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderOllama {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on OllamaCustomProviderConfig {\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderXAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on XAICustomProviderConfig {\n              xaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment GenerativeProvidersCard_data on Query {\n  modelProviders {\n    name\n    key\n    dependenciesInstalled\n    dependencies\n    credentialRequirements {\n      envVarName\n      isRequired\n    }\n    credentialsSet\n  }\n}\n\nfragment SecretsCard_data on Query {\n  secrets(first: 50) {\n    edges {\n      node {\n        id\n        key\n        value\n        shadowsEnvironmentVariable\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e513285d362f0c485989db1b377f94eb";

export default node;
