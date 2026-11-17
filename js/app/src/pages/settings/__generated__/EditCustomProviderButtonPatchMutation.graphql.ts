/**
 * @generated SignedSource<<67165920d9b99fe00f2261bdfc50eb39>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI" | "TYPESAFE";
export type ModelType = "CHAT" | "DECISION";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type PatchGenerativeModelCustomProviderMutationInput = {
  clientConfig?: GenerativeModelCustomerProviderConfigInput | null;
  description?: string | null;
  id: string;
  models?: ProviderModelsInput | null;
  name?: string | null;
  provider?: string | null;
};
export type GenerativeModelCustomerProviderConfigInput = {
  anthropic?: never;
  awsBedrock?: never;
  azureOpenai?: never;
  googleGenai?: never;
  openai: OpenAICustomProviderConfigInput;
  typesafe?: never;
} | {
  anthropic?: never;
  awsBedrock?: never;
  azureOpenai: AzureOpenAICustomProviderConfigInput;
  googleGenai?: never;
  openai?: never;
  typesafe?: never;
} | {
  anthropic: AnthropicCustomProviderConfigInput;
  awsBedrock?: never;
  azureOpenai?: never;
  googleGenai?: never;
  openai?: never;
  typesafe?: never;
} | {
  anthropic?: never;
  awsBedrock: AWSBedrockCustomProviderConfigInput;
  azureOpenai?: never;
  googleGenai?: never;
  openai?: never;
  typesafe?: never;
} | {
  anthropic?: never;
  awsBedrock?: never;
  azureOpenai?: never;
  googleGenai: GoogleGenAICustomProviderConfigInput;
  openai?: never;
  typesafe?: never;
} | {
  anthropic?: never;
  awsBedrock?: never;
  azureOpenai?: never;
  googleGenai?: never;
  openai?: never;
  typesafe: TypeSafeCustomProviderConfigInput;
};
export type OpenAICustomProviderConfigInput = {
  openaiApiType?: OpenAIApiType | null;
  openaiAuthenticationMethod: OpenAIAuthenticationMethodInput;
  openaiClientKwargs?: OpenAIClientKwargsInput | null;
};
export type OpenAIAuthenticationMethodInput = {
  apiKey: string;
};
export type OpenAIClientKwargsInput = {
  baseUrl?: string | null;
  defaultHeaders?: any | null;
  organization?: string | null;
  project?: string | null;
};
export type AzureOpenAICustomProviderConfigInput = {
  azureOpenaiAuthenticationMethod: AzureOpenAIAuthenticationMethodInput;
  azureOpenaiClientKwargs: AzureOpenAIClientKwargsInput;
  openaiApiType?: OpenAIApiType | null;
};
export type AzureOpenAIAuthenticationMethodInput = {
  apiKey: string;
  azureAdTokenProvider?: never;
  defaultCredentials?: never;
} | {
  apiKey?: never;
  azureAdTokenProvider: AzureOpenAIADTokenProviderInput;
  defaultCredentials?: never;
} | {
  apiKey?: never;
  azureAdTokenProvider?: never;
  defaultCredentials: boolean;
};
export type AzureOpenAIADTokenProviderInput = {
  azureClientId: string;
  azureClientSecret: string;
  azureTenantId: string;
  scope?: string | null;
};
export type AzureOpenAIClientKwargsInput = {
  azureEndpoint: string;
  defaultHeaders?: any | null;
};
export type AnthropicCustomProviderConfigInput = {
  anthropicAuthenticationMethod: AnthropicAuthenticationMethodInput;
  anthropicClientKwargs?: AnthropicClientKwargsInput | null;
};
export type AnthropicAuthenticationMethodInput = {
  apiKey: string;
};
export type AnthropicClientKwargsInput = {
  baseUrl?: string | null;
  defaultHeaders?: any | null;
};
export type AWSBedrockCustomProviderConfigInput = {
  awsBedrockAuthenticationMethod: AWSBedrockAuthenticationMethodInput;
  awsBedrockClientKwargs: AWSBedrockClientKwargsInput;
};
export type AWSBedrockAuthenticationMethodInput = {
  accessKeys: AWSBedrockAccessKeysInput;
  defaultCredentials?: never;
} | {
  accessKeys?: never;
  defaultCredentials: boolean;
};
export type AWSBedrockAccessKeysInput = {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsSessionToken?: string | null;
};
export type AWSBedrockClientKwargsInput = {
  endpointUrl?: string | null;
  regionName: string;
};
export type GoogleGenAICustomProviderConfigInput = {
  googleGenaiAuthenticationMethod: GoogleGenAIAuthenticationMethodInput;
  googleGenaiClientKwargs?: GoogleGenAIClientKwargsInput | null;
};
export type GoogleGenAIAuthenticationMethodInput = {
  apiKey: string;
};
export type GoogleGenAIClientKwargsInput = {
  httpOptions?: GoogleGenAIHttpOptionsInput | null;
};
export type GoogleGenAIHttpOptionsInput = {
  baseUrl?: string | null;
  headers?: any | null;
};
export type TypeSafeCustomProviderConfigInput = {
  typesafeAuthenticationMethod: TypeSafeAuthenticationMethodInput;
  typesafeClientKwargs?: TypeSafeClientKwargsInput | null;
};
export type TypeSafeAuthenticationMethodInput = {
  apiKey: string;
};
export type TypeSafeClientKwargsInput = {
  baseUrl?: string | null;
  defaultHeaders?: any | null;
};
export type ProviderModelsInput = {
  chat?: ModelsOfTypeInput | null;
  decision?: ModelsOfTypeInput | null;
};
export type ModelsOfTypeInput = {
  names?: ReadonlyArray<string>;
};
export type EditCustomProviderButtonPatchMutation$variables = {
  input: PatchGenerativeModelCustomProviderMutationInput;
};
export type EditCustomProviderButtonPatchMutation$data = {
  readonly patchGenerativeModelCustomProvider: {
    readonly provider: {
      readonly createdAt: string;
      readonly decisionModelNames: ReadonlyArray<string>;
      readonly description: string | null;
      readonly id: string;
      readonly modelNames: ReadonlyArray<string>;
      readonly modelTypes: ReadonlyArray<ModelType>;
      readonly name: string;
      readonly provider: string;
      readonly sdk: GenerativeModelSDK;
      readonly updatedAt: string;
      readonly user: {
        readonly id: string;
        readonly profilePictureUrl: string | null;
        readonly username: string;
      } | null;
      readonly " $fragmentSpreads": FragmentRefs<"CustomProviderDetailsDrawer_provider">;
    };
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"CustomProvidersCard_data">;
    };
  };
};
export type EditCustomProviderButtonPatchMutation = {
  response: EditCustomProviderButtonPatchMutation$data;
  variables: EditCustomProviderButtonPatchMutation$variables;
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
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sdk",
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
  "name": "modelTypes",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelNames",
  "storageKey": null
},
v9 = {
  "alias": "decisionModelNames",
  "args": [
    {
      "kind": "Literal",
      "name": "modelType",
      "value": "DECISION"
    }
  ],
  "kind": "ScalarField",
  "name": "modelNames",
  "storageKey": "modelNames(modelType:\"DECISION\")"
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v14 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "names",
    "storageKey": null
  }
],
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v16 = {
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
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "openaiApiType",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "apiKey",
  "storageKey": null
},
v19 = [
  (v18/*:: as any*/)
],
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultHeaders",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultCredentials",
  "storageKey": null
},
v23 = [
  (v20/*:: as any*/),
  (v21/*:: as any*/)
],
v24 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditCustomProviderButtonPatchMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PatchGenerativeModelCustomProviderMutationPayload",
        "kind": "LinkedField",
        "name": "patchGenerativeModelCustomProvider",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "GenerativeModelCustomProvider",
            "kind": "LinkedField",
            "name": "provider",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "CustomProviderDetailsDrawer_provider"
              },
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/),
              (v11/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v12/*:: as any*/),
                  (v13/*:: as any*/)
                ],
                "storageKey": null
              }
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditCustomProviderButtonPatchMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PatchGenerativeModelCustomProviderMutationPayload",
        "kind": "LinkedField",
        "name": "patchGenerativeModelCustomProvider",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "GenerativeModelCustomProvider",
            "kind": "LinkedField",
            "name": "provider",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v6/*:: as any*/),
              (v5/*:: as any*/),
              (v10/*:: as any*/),
              (v11/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v12/*:: as any*/),
                  (v2/*:: as any*/),
                  (v13/*:: as any*/)
                ],
                "storageKey": null
              },
              (v7/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ProviderModels",
                "kind": "LinkedField",
                "name": "models",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ModelsOfType",
                    "kind": "LinkedField",
                    "name": "chat",
                    "plural": false,
                    "selections": (v14/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ModelsOfType",
                    "kind": "LinkedField",
                    "name": "decision",
                    "plural": false,
                    "selections": (v14/*:: as any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": "chatModelNames",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "modelType",
                    "value": "CHAT"
                  }
                ],
                "kind": "ScalarField",
                "name": "modelNames",
                "storageKey": "modelNames(modelType:\"CHAT\")"
              },
              (v9/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v15/*:: as any*/),
                  (v16/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v17/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "OpenAIAuthenticationMethod",
                        "kind": "LinkedField",
                        "name": "openaiAuthenticationMethod",
                        "plural": false,
                        "selections": (v19/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "OpenAIClientKwargs",
                        "kind": "LinkedField",
                        "name": "openaiClientKwargs",
                        "plural": false,
                        "selections": [
                          (v20/*:: as any*/),
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
                          (v21/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "OpenAICustomProviderConfig",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v17/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "AzureOpenAIAuthenticationMethod",
                        "kind": "LinkedField",
                        "name": "azureOpenaiAuthenticationMethod",
                        "plural": false,
                        "selections": [
                          (v18/*:: as any*/),
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
                          (v22/*:: as any*/)
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
                            "kind": "ScalarField",
                            "name": "azureEndpoint",
                            "storageKey": null
                          },
                          (v21/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "AzureOpenAICustomProviderConfig",
                    "abstractKey": null
                  },
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
                        "selections": (v19/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "AnthropicClientKwargs",
                        "kind": "LinkedField",
                        "name": "anthropicClientKwargs",
                        "plural": false,
                        "selections": (v23/*:: as any*/),
                        "storageKey": null
                      }
                    ],
                    "type": "AnthropicCustomProviderConfig",
                    "abstractKey": null
                  },
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
                            "concreteType": "AWSBedrockAccessKeys",
                            "kind": "LinkedField",
                            "name": "accessKeys",
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
                              }
                            ],
                            "storageKey": null
                          },
                          (v22/*:: as any*/)
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
                            "kind": "ScalarField",
                            "name": "regionName",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "endpointUrl",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "AWSBedrockCustomProviderConfig",
                    "abstractKey": null
                  },
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
                        "selections": (v19/*:: as any*/),
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
                              (v20/*:: as any*/),
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
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "TypeSafeAuthenticationMethod",
                        "kind": "LinkedField",
                        "name": "typesafeAuthenticationMethod",
                        "plural": false,
                        "selections": (v19/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "TypeSafeClientKwargs",
                        "kind": "LinkedField",
                        "name": "typesafeClientKwargs",
                        "plural": false,
                        "selections": (v23/*:: as any*/),
                        "storageKey": null
                      }
                    ],
                    "type": "TypeSafeCustomProviderConfig",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              },
              (v8/*:: as any*/)
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
                "alias": null,
                "args": (v24/*:: as any*/),
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
                          (v3/*:: as any*/),
                          (v5/*:: as any*/),
                          (v6/*:: as any*/),
                          (v7/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "config",
                            "plural": false,
                            "selections": [
                              (v15/*:: as any*/),
                              (v16/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v15/*:: as any*/)
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
                "args": (v24/*:: as any*/),
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
    "cacheID": "0933463b819c868fd6ddbfa56ebab47e",
    "id": null,
    "metadata": {},
    "name": "EditCustomProviderButtonPatchMutation",
    "operationKind": "mutation",
    "text": "mutation EditCustomProviderButtonPatchMutation(\n  $input: PatchGenerativeModelCustomProviderMutationInput!\n) {\n  patchGenerativeModelCustomProvider(input: $input) {\n    provider {\n      id\n      ...CustomProviderDetailsDrawer_provider\n      name\n      description\n      sdk\n      provider\n      modelTypes\n      modelNames\n      decisionModelNames: modelNames(modelType: DECISION)\n      createdAt\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n    }\n    query {\n      ...CustomProvidersCard_data\n    }\n  }\n}\n\nfragment CustomProviderDetailsDrawer_provider on GenerativeModelCustomProvider {\n  id\n  name\n  description\n  provider\n  sdk\n  createdAt\n  updatedAt\n  user {\n    username\n    id\n  }\n  modelTypes\n  models {\n    chat {\n      names\n    }\n    decision {\n      names\n    }\n  }\n  chatModelNames: modelNames(modelType: CHAT)\n  decisionModelNames: modelNames(modelType: DECISION)\n  config {\n    __typename\n    ... on UnparsableConfig {\n      parseError\n    }\n    ... on OpenAICustomProviderConfig {\n      openaiApiType\n      openaiAuthenticationMethod {\n        apiKey\n      }\n      openaiClientKwargs {\n        baseUrl\n        organization\n        project\n        defaultHeaders\n      }\n    }\n    ... on AzureOpenAICustomProviderConfig {\n      openaiApiType\n      azureOpenaiAuthenticationMethod {\n        apiKey\n        azureAdTokenProvider {\n          azureTenantId\n          azureClientId\n          azureClientSecret\n          scope\n        }\n        defaultCredentials\n      }\n      azureOpenaiClientKwargs {\n        azureEndpoint\n        defaultHeaders\n      }\n    }\n    ... on AnthropicCustomProviderConfig {\n      anthropicAuthenticationMethod {\n        apiKey\n      }\n      anthropicClientKwargs {\n        baseUrl\n        defaultHeaders\n      }\n    }\n    ... on AWSBedrockCustomProviderConfig {\n      awsBedrockAuthenticationMethod {\n        accessKeys {\n          awsAccessKeyId\n          awsSecretAccessKey\n          awsSessionToken\n        }\n        defaultCredentials\n      }\n      awsBedrockClientKwargs {\n        regionName\n        endpointUrl\n      }\n    }\n    ... on GoogleGenAICustomProviderConfig {\n      googleGenaiAuthenticationMethod {\n        apiKey\n      }\n      googleGenaiClientKwargs {\n        httpOptions {\n          baseUrl\n          headers\n        }\n      }\n    }\n    ... on TypeSafeCustomProviderConfig {\n      typesafeAuthenticationMethod {\n        apiKey\n      }\n      typesafeClientKwargs {\n        baseUrl\n        defaultHeaders\n      }\n    }\n  }\n}\n\nfragment CustomProvidersCard_data on Query {\n  generativeModelCustomProviders(first: 50) {\n    edges {\n      node {\n        id\n        name\n        sdk\n        provider\n        modelTypes\n        config {\n          __typename\n          ... on UnparsableConfig {\n            parseError\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5c2a4d00afcc904cb5aa1fb8a3cfa115";

export default node;
