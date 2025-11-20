/**
 * @generated SignedSource<<579160bff3af17c4e52bc82c0db6179f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CustomProvidersCardQuery$variables = {
  after?: string | null;
  first?: number | null;
};
export type CustomProvidersCardQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"CustomProvidersCard_data">;
};
export type CustomProvidersCardQuery = {
  response: CustomProvidersCardQuery$data;
  variables: CustomProvidersCardQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": 50,
    "kind": "LocalArgument",
    "name": "first"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
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
v5 = [
  (v2/*: any*/),
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
v6 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "apiKey",
  "plural": false,
  "selections": (v5/*: any*/),
  "storageKey": null
},
v7 = [
  (v6/*: any*/)
],
v8 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "baseUrl",
  "plural": false,
  "selections": (v5/*: any*/),
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultHeaders",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "OpenAIClientKwargs",
  "kind": "LinkedField",
  "name": "openaiClientKwargs",
  "plural": false,
  "selections": [
    (v8/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "organization",
      "plural": false,
      "selections": (v5/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": (v5/*: any*/),
      "storageKey": null
    },
    (v9/*: any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CustomProvidersCardQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "CustomProvidersCard_data"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CustomProvidersCardQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                  (v2/*: any*/),
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
                      (v3/*: any*/),
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
                          (v2/*: any*/),
                          (v4/*: any*/),
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
                                "selections": (v7/*: any*/),
                                "storageKey": null
                              },
                              (v10/*: any*/)
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
                          (v2/*: any*/),
                          (v4/*: any*/),
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
                                  (v6/*: any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "azureAdToken",
                                    "plural": false,
                                    "selections": (v5/*: any*/),
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
                                        "selections": (v5/*: any*/),
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "azureClientId",
                                        "plural": false,
                                        "selections": (v5/*: any*/),
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "azureClientSecret",
                                        "plural": false,
                                        "selections": (v5/*: any*/),
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "scope",
                                        "plural": false,
                                        "selections": (v5/*: any*/),
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
                                    "selections": (v5/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "azureEndpoint",
                                    "plural": false,
                                    "selections": (v5/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "azureDeployment",
                                    "plural": false,
                                    "selections": (v5/*: any*/),
                                    "storageKey": null
                                  },
                                  (v9/*: any*/)
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
                          (v2/*: any*/),
                          (v4/*: any*/),
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
                                "selections": (v7/*: any*/),
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
                                  (v8/*: any*/),
                                  (v9/*: any*/)
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
                          (v2/*: any*/),
                          (v4/*: any*/),
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
                                    "selections": (v5/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "awsSecretAccessKey",
                                    "plural": false,
                                    "selections": (v5/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "awsSessionToken",
                                    "plural": false,
                                    "selections": (v5/*: any*/),
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
                                    "selections": (v5/*: any*/),
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
                          (v2/*: any*/),
                          (v4/*: any*/),
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
                                "selections": (v7/*: any*/),
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
                                      (v8/*: any*/),
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
                          (v2/*: any*/),
                          (v4/*: any*/),
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
                                "selections": (v7/*: any*/),
                                "storageKey": null
                              },
                              (v10/*: any*/)
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
                          (v2/*: any*/),
                          (v4/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v10/*: any*/)
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
                          (v2/*: any*/),
                          (v4/*: any*/),
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
                                "selections": (v7/*: any*/),
                                "storageKey": null
                              },
                              (v10/*: any*/)
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
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "filters": null,
        "handle": "connection",
        "key": "CustomProvidersCard_generativeModelCustomProviders",
        "kind": "LinkedHandle",
        "name": "generativeModelCustomProviders"
      }
    ]
  },
  "params": {
    "cacheID": "7c95b69070e9ee27ce2099f7c67c5d34",
    "id": null,
    "metadata": {},
    "name": "CustomProvidersCardQuery",
    "operationKind": "query",
    "text": "query CustomProvidersCardQuery(\n  $after: String = null\n  $first: Int = 50\n) {\n  ...CustomProvidersCard_data_2HEEH6\n}\n\nfragment CustomProvidersCard_data_2HEEH6 on Query {\n  generativeModelCustomProviders(first: $first, after: $after) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        description\n        sdk\n        provider\n        createdAt\n        updatedAt\n        user {\n          id\n          username\n          profilePictureUrl\n        }\n        ... on GenerativeModelCustomProviderOpenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on OpenAICustomProviderConfig {\n              openaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAzureOpenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on AzureOpenAICustomProviderConfig {\n              azureOpenaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureAdToken {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureAdTokenProvider {\n                  azureTenantId {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  azureClientId {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  azureClientSecret {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  scope {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                }\n              }\n              azureOpenaiClientKwargs {\n                apiVersion {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureEndpoint {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureDeployment {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAnthropic {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on AnthropicCustomProviderConfig {\n              anthropicAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              anthropicClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAWSBedrock {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on AWSBedrockCustomProviderConfig {\n              awsBedrockAuthenticationMethod {\n                awsAccessKeyId {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                awsSecretAccessKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                awsSessionToken {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              awsBedrockClientKwargs {\n                regionName {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderGoogleGenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on GoogleGenAICustomProviderConfig {\n              googleGenaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              googleGenaiClientKwargs {\n                httpOptions {\n                  baseUrl {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  headers\n                }\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderDeepSeek {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on DeepSeekCustomProviderConfig {\n              deepseekAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderOllama {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on OllamaCustomProviderConfig {\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderXAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on XAICustomProviderConfig {\n              xaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3fd890ffee486a290bdcc02f64ef7947";

export default node;
