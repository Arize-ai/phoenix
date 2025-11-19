/**
 * @generated SignedSource<<d985d732f9aa80a4c8e6b6b95cfed02f>>
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
  deepseek?: DeepSeekCustomProviderConfigInput | null;
  googleGenai?: GoogleGenAICustomProviderConfigInput | null;
  ollama?: OllamaCustomProviderConfigInput | null;
  openai?: OpenAICustomProviderConfigInput | null;
  xai?: XAICustomProviderConfigInput | null;
};
export type OpenAICustomProviderConfigInput = {
  openaiAuthenticationMethod: OpenAIAuthenticationMethodInput;
  openaiClientKwargs?: OpenAIClientKwargsInput | null;
};
export type OpenAIAuthenticationMethodInput = {
  apiKey?: StringValueLookupOrStringValueInput | null;
};
export type StringValueLookupOrStringValueInput = {
  stringValue?: string | null;
  stringValueLookupKey?: string | null;
};
export type OpenAIClientKwargsInput = {
  baseUrl?: StringValueLookupOrStringValueInput | null;
  defaultHeaders?: any | null;
  organization?: StringValueLookupOrStringValueInput | null;
  project?: StringValueLookupOrStringValueInput | null;
};
export type AzureOpenAICustomProviderConfigInput = {
  azureOpenaiAuthenticationMethod: AzureOpenAIAuthenticationMethodInput;
  azureOpenaiClientKwargs: AzureOpenAIClientKwargsInput;
};
export type AzureOpenAIAuthenticationMethodInput = {
  apiKey?: StringValueLookupOrStringValueInput | null;
  azureAdToken?: StringValueLookupOrStringValueInput | null;
  azureAdTokenProvider?: AzureOpenAIADTokenProviderInput | null;
};
export type AzureOpenAIADTokenProviderInput = {
  azureClientId?: StringValueLookupOrStringValueInput | null;
  azureClientSecret?: StringValueLookupOrStringValueInput | null;
  azureTenantId?: StringValueLookupOrStringValueInput | null;
  scope?: StringValueLookupOrStringValueInput | null;
};
export type AzureOpenAIClientKwargsInput = {
  apiVersion: StringValueLookupOrStringValueInput;
  azureDeployment: StringValueLookupOrStringValueInput;
  azureEndpoint: StringValueLookupOrStringValueInput;
  defaultHeaders?: any | null;
};
export type AnthropicCustomProviderConfigInput = {
  anthropicAuthenticationMethod: AnthropicAuthenticationMethodInput;
  anthropicClientKwargs?: AnthropicClientKwargsInput | null;
};
export type AnthropicAuthenticationMethodInput = {
  apiKey?: StringValueLookupOrStringValueInput | null;
};
export type AnthropicClientKwargsInput = {
  baseUrl?: StringValueLookupOrStringValueInput | null;
  defaultHeaders?: any | null;
};
export type AWSBedrockCustomProviderConfigInput = {
  awsBedrockAuthenticationMethod: AWSBedrockAuthenticationMethodInput;
  awsBedrockClientKwargs: AWSBedrockClientKwargsInput;
};
export type AWSBedrockAuthenticationMethodInput = {
  awsAccessKeyId?: StringValueLookupOrStringValueInput | null;
  awsSecretAccessKey?: StringValueLookupOrStringValueInput | null;
  awsSessionToken?: StringValueLookupOrStringValueInput | null;
};
export type AWSBedrockClientKwargsInput = {
  endpointUrl?: StringValueLookupOrStringValueInput | null;
  regionName: StringValueLookupOrStringValueInput;
};
export type GoogleGenAICustomProviderConfigInput = {
  googleGenaiAuthenticationMethod: GoogleGenAIAuthenticationMethodInput;
  googleGenaiClientKwargs?: GoogleGenAIClientKwargsInput | null;
};
export type GoogleGenAIAuthenticationMethodInput = {
  apiKey?: StringValueLookupOrStringValueInput | null;
};
export type GoogleGenAIClientKwargsInput = {
  httpOptions?: GoogleGenAIHttpOptionsInput | null;
};
export type GoogleGenAIHttpOptionsInput = {
  baseUrl?: StringValueLookupOrStringValueInput | null;
  headers?: any | null;
};
export type OllamaCustomProviderConfigInput = {
  openaiClientKwargs?: OpenAIClientKwargsInput | null;
};
export type DeepSeekCustomProviderConfigInput = {
  deepseekAuthenticationMethod: DeepSeekAuthenticationMethodInput;
  openaiClientKwargs?: OpenAIClientKwargsInput | null;
};
export type DeepSeekAuthenticationMethodInput = {
  apiKey?: StringValueLookupOrStringValueInput | null;
};
export type XAICustomProviderConfigInput = {
  openaiClientKwargs?: OpenAIClientKwargsInput | null;
  xaiAuthenticationMethod: XAIAuthenticationMethodInput;
};
export type XAIAuthenticationMethodInput = {
  apiKey?: StringValueLookupOrStringValueInput | null;
};
export type NewCustomProviderButtonCreateMutation$variables = {
  connectionId: string;
  input: CreateGenerativeModelCustomProviderMutationInput;
};
export type NewCustomProviderButtonCreateMutation$data = {
  readonly createGenerativeModelCustomProvider: {
    readonly provider: {
      readonly createdAt: string;
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
export type NewCustomProviderButtonCreateMutation = {
  response: NewCustomProviderButtonCreateMutation$data;
  variables: NewCustomProviderButtonCreateMutation$variables;
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
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v10 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v11 = {
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
v12 = [
  (v9/*: any*/),
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
v13 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "apiKey",
  "plural": false,
  "selections": (v12/*: any*/),
  "storageKey": null
},
v14 = [
  (v13/*: any*/)
],
v15 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "baseUrl",
  "plural": false,
  "selections": (v12/*: any*/),
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultHeaders",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "OpenAIClientKwargs",
  "kind": "LinkedField",
  "name": "openaiClientKwargs",
  "plural": false,
  "selections": [
    (v15/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "organization",
      "plural": false,
      "selections": (v12/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": (v12/*: any*/),
      "storageKey": null
    },
    (v16/*: any*/)
  ],
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
    "name": "NewCustomProviderButtonCreateMutation",
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
              (v8/*: any*/)
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
    "name": "NewCustomProviderButtonCreateMutation",
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
              (v9/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/)
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
                "args": (v10/*: any*/),
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
                          (v9/*: any*/),
                          (v3/*: any*/),
                          (v4/*: any*/),
                          (v5/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "sdk",
                            "storageKey": null
                          },
                          (v6/*: any*/),
                          (v7/*: any*/),
                          (v8/*: any*/),
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
                                  (v9/*: any*/),
                                  (v11/*: any*/),
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
                                        "selections": (v14/*: any*/),
                                        "storageKey": null
                                      },
                                      (v17/*: any*/)
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
                                  (v9/*: any*/),
                                  (v11/*: any*/),
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
                                          (v13/*: any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": null,
                                            "kind": "LinkedField",
                                            "name": "azureAdToken",
                                            "plural": false,
                                            "selections": (v12/*: any*/),
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
                                                "selections": (v12/*: any*/),
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "concreteType": null,
                                                "kind": "LinkedField",
                                                "name": "azureClientId",
                                                "plural": false,
                                                "selections": (v12/*: any*/),
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "concreteType": null,
                                                "kind": "LinkedField",
                                                "name": "azureClientSecret",
                                                "plural": false,
                                                "selections": (v12/*: any*/),
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "concreteType": null,
                                                "kind": "LinkedField",
                                                "name": "scope",
                                                "plural": false,
                                                "selections": (v12/*: any*/),
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
                                            "selections": (v12/*: any*/),
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": null,
                                            "kind": "LinkedField",
                                            "name": "azureEndpoint",
                                            "plural": false,
                                            "selections": (v12/*: any*/),
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": null,
                                            "kind": "LinkedField",
                                            "name": "azureDeployment",
                                            "plural": false,
                                            "selections": (v12/*: any*/),
                                            "storageKey": null
                                          },
                                          (v16/*: any*/)
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
                                  (v9/*: any*/),
                                  (v11/*: any*/),
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
                                        "selections": (v14/*: any*/),
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
                                          (v15/*: any*/),
                                          (v16/*: any*/)
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
                                  (v9/*: any*/),
                                  (v11/*: any*/),
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
                                            "selections": (v12/*: any*/),
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": null,
                                            "kind": "LinkedField",
                                            "name": "awsSecretAccessKey",
                                            "plural": false,
                                            "selections": (v12/*: any*/),
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": null,
                                            "kind": "LinkedField",
                                            "name": "awsSessionToken",
                                            "plural": false,
                                            "selections": (v12/*: any*/),
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
                                            "selections": (v12/*: any*/),
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
                                  (v9/*: any*/),
                                  (v11/*: any*/),
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
                                        "selections": (v14/*: any*/),
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
                                              (v15/*: any*/),
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
                                  (v9/*: any*/),
                                  (v11/*: any*/),
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
                                        "selections": (v14/*: any*/),
                                        "storageKey": null
                                      },
                                      (v17/*: any*/)
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
                                  (v9/*: any*/),
                                  (v11/*: any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v17/*: any*/)
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
                                  (v9/*: any*/),
                                  (v11/*: any*/),
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
                                        "selections": (v14/*: any*/),
                                        "storageKey": null
                                      },
                                      (v17/*: any*/)
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
                "storageKey": "generativeModelCustomProviders(first:50)"
              },
              {
                "alias": null,
                "args": (v10/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "CustomProvidersCard_generativeModelCustomProviders",
                "kind": "LinkedHandle",
                "name": "generativeModelCustomProviders"
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
    "cacheID": "61dd57415e144d712543e89e82842184",
    "id": null,
    "metadata": {},
    "name": "NewCustomProviderButtonCreateMutation",
    "operationKind": "mutation",
    "text": "mutation NewCustomProviderButtonCreateMutation(\n  $input: CreateGenerativeModelCustomProviderMutationInput!\n) {\n  createGenerativeModelCustomProvider(input: $input) {\n    provider {\n      __typename\n      id\n      name\n      description\n      provider\n      createdAt\n      updatedAt\n    }\n    query {\n      ...CustomProvidersCard_data\n    }\n  }\n}\n\nfragment CustomProvidersCard_data on Query {\n  generativeModelCustomProviders(first: 50) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        description\n        sdk\n        provider\n        createdAt\n        updatedAt\n        user {\n          id\n          username\n          profilePictureUrl\n        }\n        ... on GenerativeModelCustomProviderOpenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on OpenAICustomProviderConfig {\n              openaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAzureOpenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on AzureOpenAICustomProviderConfig {\n              azureOpenaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureAdToken {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureAdTokenProvider {\n                  azureTenantId {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  azureClientId {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  azureClientSecret {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  scope {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                }\n              }\n              azureOpenaiClientKwargs {\n                apiVersion {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureEndpoint {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                azureDeployment {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAnthropic {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on AnthropicCustomProviderConfig {\n              anthropicAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              anthropicClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAWSBedrock {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on AWSBedrockCustomProviderConfig {\n              awsBedrockAuthenticationMethod {\n                awsAccessKeyId {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                awsSecretAccessKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                awsSessionToken {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              awsBedrockClientKwargs {\n                regionName {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderGoogleGenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on GoogleGenAICustomProviderConfig {\n              googleGenaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              googleGenaiClientKwargs {\n                httpOptions {\n                  baseUrl {\n                    __typename\n                    ... on StringValue {\n                      stringValue\n                    }\n                    ... on StringValueLookup {\n                      stringValueLookupKey\n                    }\n                  }\n                  headers\n                }\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderDeepSeek {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on DeepSeekCustomProviderConfig {\n              deepseekAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderOllama {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on OllamaCustomProviderConfig {\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderXAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n            ... on XAICustomProviderConfig {\n              xaiAuthenticationMethod {\n                apiKey {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n              }\n              openaiClientKwargs {\n                baseUrl {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                organization {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                project {\n                  __typename\n                  ... on StringValue {\n                    stringValue\n                  }\n                  ... on StringValueLookup {\n                    stringValueLookupKey\n                  }\n                }\n                defaultHeaders\n              }\n            }\n          }\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2930398d59bcf28d494e567e2b6d10be";

export default node;
