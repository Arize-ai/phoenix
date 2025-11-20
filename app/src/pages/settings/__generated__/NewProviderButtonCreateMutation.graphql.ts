/**
 * @generated SignedSource<<18a70b88606860913e6bf387b3994cbf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateGenerativeModelCustomProviderMutationInput = {
  clientConfig: GenerativeModelCustomerProviderConfigInput;
  description?: string | null;
  name: string;
  provider: string;
};
export type GenerativeModelCustomerProviderConfigInput = {
  anthropic?: AnthropicCustomProviderConfigInput | null;
  awsBedrock?: AWSBedrockCustomProviderConfigInput | null;
  azureOpenai?: AzureOpenAICustomProviderConfigInput | null;
  googleGenai?: GoogleGenAICustomProviderConfigInput | null;
  openai?: OpenAICustomProviderConfigInput | null;
};
export type OpenAICustomProviderConfigInput = {
  openaiKwargs: OpenAIClientKwargsInput;
};
export type OpenAIClientKwargsInput = {
  apiKey: string;
  baseUrl?: string | null;
  defaultHeaders?: any | null;
  defaultQuery?: any | null;
  organization?: string | null;
  project?: string | null;
};
export type AzureOpenAICustomProviderConfigInput = {
  azureOpenaiKwargs: AzureOpenAIClientKwargsInput;
};
export type AzureOpenAIClientKwargsInput = {
  apiKey?: string | null;
  apiVersion: string;
  azureAdToken?: string | null;
  azureAdTokenProvider?: AzureOpenAIADTokenProviderInput | null;
  azureDeployment: string;
  azureEndpoint: string;
  defaultHeaders?: any | null;
  defaultQuery?: any | null;
};
export type AzureOpenAIADTokenProviderInput = {
  azureClientId: string;
  azureClientSecret: string;
  azureTenantId: string;
  scope?: string;
};
export type AnthropicCustomProviderConfigInput = {
  anthropicKwargs: AnthropicClientKwargsInput;
};
export type AnthropicClientKwargsInput = {
  apiKey: string;
  baseUrl?: string | null;
  defaultHeaders?: any | null;
  defaultQuery?: any | null;
};
export type AWSBedrockCustomProviderConfigInput = {
  awsBedrockKwargs: AWSBedrockClientKwargsInput;
};
export type AWSBedrockClientKwargsInput = {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsSessionToken?: string | null;
  regionName?: string;
};
export type GoogleGenAICustomProviderConfigInput = {
  googleGenaiKwargs: GoogleGenAIClientKwargsInput;
};
export type GoogleGenAIClientKwargsInput = {
  apiKey: string;
  httpOptions: GoogleGenAIHttpOptionsInput;
};
export type GoogleGenAIHttpOptionsInput = {
  apiVersion?: string | null;
  baseUrl?: string | null;
  extraBody?: any | null;
  headers?: any | null;
  retryOptions?: GoogleGenAIHttpRetryOptionsInput | null;
  timeout?: number | null;
};
export type GoogleGenAIHttpRetryOptionsInput = {
  attempts?: number;
  expBase?: number;
  httpStatusCodes?: ReadonlyArray<number> | null;
  initialDelay?: number;
  jitter?: number;
  maxDelay?: number;
};
export type NewProviderButtonCreateMutation$variables = {
  connectionId: string;
  input: CreateGenerativeModelCustomProviderMutationInput;
};
export type NewProviderButtonCreateMutation$data = {
  readonly createGenerativeModelCustomProvider: {
    readonly provider: {
      readonly createdAt: string;
      readonly dependencies: ReadonlyArray<{
        readonly installedVersion: string | null;
        readonly minimumVersion: string;
        readonly package: string;
      }>;
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
      readonly provider: string;
      readonly updatedAt: string;
    };
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"CustomProvidersCard_data">;
    };
  };
};
export type NewProviderButtonCreateMutation = {
  response: NewProviderButtonCreateMutation$data;
  variables: NewProviderButtonCreateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "provider",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProviderDependency",
  "kind": "LinkedField",
  "name": "dependencies",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "package",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "minimumVersion",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "installedVersion",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v11 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "apiKey",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultHeaders",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultQuery",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "apiVersion",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "NewProviderButtonCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "CreateGenerativeModelCustomProviderMutationPayload",
        "kind": "LinkedField",
        "name": "createGenerativeModelCustomProvider",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "provider",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/)
            ],
            "storageKey": null
          },
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
                "name": "CustomProvidersCard_data"
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
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "NewProviderButtonCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "CreateGenerativeModelCustomProviderMutationPayload",
        "kind": "LinkedField",
        "name": "createGenerativeModelCustomProvider",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "provider",
            "plural": false,
            "selections": [
              (v10/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "provider",
            "handleArgs": [
              {
                "items": [
                  {
                    "kind": "Variable",
                    "name": "connections.0",
                    "variableName": "connectionId"
                  }
                ],
                "kind": "ListValue",
                "name": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "GenerativeModelCustomProviderEdge"
              }
            ]
          },
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
                "args": (v11/*: any*/),
                "concreteType": "GenerativeModelCustomProviderConnection",
                "kind": "LinkedField",
                "name": "GenerativeModelCustomProviders",
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
                          (v10/*: any*/),
                          (v3/*: any*/),
                          (v4/*: any*/),
                          (v5/*: any*/),
                          (v6/*: any*/),
                          (v7/*: any*/),
                          (v8/*: any*/),
                          (v9/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "OpenAICustomProviderConfig",
                                "kind": "LinkedField",
                                "name": "config",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "OpenAIClientKwargs",
                                    "kind": "LinkedField",
                                    "name": "openaiKwargs",
                                    "plural": false,
                                    "selections": [
                                      (v12/*: any*/),
                                      (v13/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "organization",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "project",
                                        "storageKey": null
                                      },
                                      (v14/*: any*/),
                                      (v15/*: any*/)
                                    ],
                                    "storageKey": null
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
                                "concreteType": "AzureOpenAICustomProviderConfig",
                                "kind": "LinkedField",
                                "name": "config",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "AzureOpenAIClientKwargs",
                                    "kind": "LinkedField",
                                    "name": "azureOpenaiKwargs",
                                    "plural": false,
                                    "selections": [
                                      (v16/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "azureEndpoint",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "azureDeployment",
                                        "storageKey": null
                                      },
                                      (v12/*: any*/),
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
                                            "kind": "ScalarField",
                                            "name": "azureTenantId",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "azureClientId",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "azureClientSecret",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "scope",
                                            "storageKey": null
                                          }
                                        ],
                                        "storageKey": null
                                      },
                                      (v14/*: any*/),
                                      (v15/*: any*/)
                                    ],
                                    "storageKey": null
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
                                "concreteType": "AnthropicCustomProviderConfig",
                                "kind": "LinkedField",
                                "name": "config",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "AnthropicClientKwargs",
                                    "kind": "LinkedField",
                                    "name": "anthropicKwargs",
                                    "plural": false,
                                    "selections": [
                                      (v12/*: any*/),
                                      (v13/*: any*/),
                                      (v14/*: any*/),
                                      (v15/*: any*/)
                                    ],
                                    "storageKey": null
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
                                "concreteType": "AWSBedrockCustomProviderConfig",
                                "kind": "LinkedField",
                                "name": "config",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "AWSBedrockClientKwargs",
                                    "kind": "LinkedField",
                                    "name": "awsBedrockKwargs",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "awsAccessKeyId",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "awsSecretAccessKey",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "awsSessionToken",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "regionName",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
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
                                "concreteType": "GoogleGenAICustomProviderConfig",
                                "kind": "LinkedField",
                                "name": "config",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "GoogleGenAIClientKwargs",
                                    "kind": "LinkedField",
                                    "name": "googleGenaiKwargs",
                                    "plural": false,
                                    "selections": [
                                      (v12/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "GoogleGenAIHttpOptions",
                                        "kind": "LinkedField",
                                        "name": "httpOptions",
                                        "plural": false,
                                        "selections": [
                                          (v13/*: any*/),
                                          (v16/*: any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "timeout",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "headers",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "extraBody",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "GoogleGenAIHttpRetryOptions",
                                            "kind": "LinkedField",
                                            "name": "retryOptions",
                                            "plural": false,
                                            "selections": [
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "attempts",
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "initialDelay",
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "maxDelay",
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "expBase",
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "jitter",
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "httpStatusCodes",
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
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "GenerativeModelCustomProviderGoogleGenAI",
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
                "storageKey": "GenerativeModelCustomProviders(first:50)"
              },
              {
                "alias": null,
                "args": (v11/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "CustomProvidersCard_GenerativeModelCustomProviders",
                "kind": "LinkedHandle",
                "name": "GenerativeModelCustomProviders"
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
    "cacheID": "4ec309cb00e0a69b2b28c7276a4e8271",
    "id": null,
    "metadata": {},
    "name": "NewProviderButtonCreateMutation",
    "operationKind": "mutation",
    "text": "mutation NewProviderButtonCreateMutation(\n  $input: CreateGenerativeModelCustomProviderMutationInput!\n) {\n  createGenerativeModelCustomProvider(input: $input) {\n    provider {\n      __typename\n      id\n      name\n      description\n      provider\n      createdAt\n      updatedAt\n      dependencies {\n        package\n        minimumVersion\n        installedVersion\n      }\n    }\n    query {\n      ...CustomProvidersCard_data\n    }\n  }\n}\n\nfragment CustomProvidersCard_data on Query {\n  GenerativeModelCustomProviders(first: 50) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        description\n        provider\n        createdAt\n        updatedAt\n        dependencies {\n          package\n          minimumVersion\n          installedVersion\n        }\n        ... on GenerativeModelCustomProviderOpenAI {\n          config {\n            openaiKwargs {\n              apiKey\n              baseUrl\n              organization\n              project\n              defaultHeaders\n              defaultQuery\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAzureOpenAI {\n          config {\n            azureOpenaiKwargs {\n              apiVersion\n              azureEndpoint\n              azureDeployment\n              apiKey\n              azureAdTokenProvider {\n                azureTenantId\n                azureClientId\n                azureClientSecret\n                scope\n              }\n              defaultHeaders\n              defaultQuery\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAnthropic {\n          config {\n            anthropicKwargs {\n              apiKey\n              baseUrl\n              defaultHeaders\n              defaultQuery\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAWSBedrock {\n          config {\n            awsBedrockKwargs {\n              awsAccessKeyId\n              awsSecretAccessKey\n              awsSessionToken\n              regionName\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderGoogleGenAI {\n          config {\n            googleGenaiKwargs {\n              apiKey\n              httpOptions {\n                baseUrl\n                apiVersion\n                timeout\n                headers\n                extraBody\n                retryOptions {\n                  attempts\n                  initialDelay\n                  maxDelay\n                  expBase\n                  jitter\n                  httpStatusCodes\n                }\n              }\n            }\n          }\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "adb7623937b8e128b70289b1a18a14ea";

export default node;
