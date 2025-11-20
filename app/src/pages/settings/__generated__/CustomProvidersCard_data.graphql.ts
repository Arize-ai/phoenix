/**
 * @generated SignedSource<<4931af12d6377ad0a905b8b7cce154fd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeModelCustomProviderSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI";
import { FragmentRefs } from "relay-runtime";
export type CustomProvidersCard_data$data = {
  readonly generativeModelCustomProviders: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly config?: {
          readonly anthropicAuthenticationMethod?: {
            readonly apiKey: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
          };
          readonly anthropicClientKwargs?: {
            readonly baseUrl: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
            readonly defaultHeaders: any | null;
          } | null;
          readonly awsBedrockAuthenticationMethod?: {
            readonly awsAccessKeyId: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
            readonly awsSecretAccessKey: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
            readonly awsSessionToken: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
          };
          readonly awsBedrockClientKwargs?: {
            readonly regionName: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
          } | null;
          readonly azureOpenaiAuthenticationMethod?: {
            readonly apiKey: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
            readonly azureAdToken: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
            readonly azureAdTokenProvider: {
              readonly azureClientId: {
                readonly stringValue?: string;
                readonly stringValueLookupKey?: string;
              } | null;
              readonly azureClientSecret: {
                readonly stringValue?: string;
                readonly stringValueLookupKey?: string;
              } | null;
              readonly azureTenantId: {
                readonly stringValue?: string;
                readonly stringValueLookupKey?: string;
              } | null;
              readonly scope: {
                readonly stringValue?: string;
                readonly stringValueLookupKey?: string;
              } | null;
            } | null;
          };
          readonly azureOpenaiClientKwargs?: {
            readonly apiVersion: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
            readonly azureDeployment: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
            readonly azureEndpoint: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
            readonly defaultHeaders: any | null;
          } | null;
          readonly deepseekAuthenticationMethod?: {
            readonly apiKey: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
          };
          readonly googleGenaiAuthenticationMethod?: {
            readonly apiKey: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
          };
          readonly googleGenaiClientKwargs?: {
            readonly httpOptions: {
              readonly baseUrl: {
                readonly stringValue?: string;
                readonly stringValueLookupKey?: string;
              } | null;
              readonly headers: any | null;
            } | null;
          } | null;
          readonly openaiAuthenticationMethod?: {
            readonly apiKey: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
          };
          readonly openaiClientKwargs?: {
            readonly baseUrl: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
            readonly defaultHeaders: any | null;
            readonly organization: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
            readonly project: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
          } | null;
          readonly parseError?: string;
          readonly xaiAuthenticationMethod?: {
            readonly apiKey: {
              readonly stringValue?: string;
              readonly stringValueLookupKey?: string;
            } | null;
          };
        };
        readonly createdAt: string;
        readonly description: string | null;
        readonly id: string;
        readonly name: string;
        readonly provider: string;
        readonly sdk: GenerativeModelCustomProviderSDK;
        readonly updatedAt: string;
        readonly user: {
          readonly id: string;
          readonly profilePictureUrl: string | null;
          readonly username: string;
        } | null;
      };
    }>;
  };
  readonly " $fragmentType": "CustomProvidersCard_data";
};
export type CustomProvidersCard_data$key = {
  readonly " $data"?: CustomProvidersCard_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"CustomProvidersCard_data">;
};

import CustomProvidersCardQuery_graphql from './CustomProvidersCardQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "generativeModelCustomProviders"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
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
v3 = [
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
v4 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "apiKey",
  "plural": false,
  "selections": (v3/*: any*/),
  "storageKey": null
},
v5 = [
  (v4/*: any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "baseUrl",
  "plural": false,
  "selections": (v3/*: any*/),
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultHeaders",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "OpenAIClientKwargs",
  "kind": "LinkedField",
  "name": "openaiClientKwargs",
  "plural": false,
  "selections": [
    (v6/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "organization",
      "plural": false,
      "selections": (v3/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": (v3/*: any*/),
      "storageKey": null
    },
    (v7/*: any*/)
  ],
  "storageKey": null
};
return {
  "argumentDefinitions": [
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
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": CustomProvidersCardQuery_graphql
    }
  },
  "name": "CustomProvidersCard_data",
  "selections": [
    {
      "alias": "generativeModelCustomProviders",
      "args": null,
      "concreteType": "GenerativeModelCustomProviderConnection",
      "kind": "LinkedField",
      "name": "__CustomProvidersCard_generativeModelCustomProviders_connection",
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
                (v1/*: any*/),
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
                    (v1/*: any*/),
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
                              "selections": (v5/*: any*/),
                              "storageKey": null
                            },
                            (v8/*: any*/)
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
                                (v4/*: any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": null,
                                  "kind": "LinkedField",
                                  "name": "azureAdToken",
                                  "plural": false,
                                  "selections": (v3/*: any*/),
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
                                      "selections": (v3/*: any*/),
                                      "storageKey": null
                                    },
                                    {
                                      "alias": null,
                                      "args": null,
                                      "concreteType": null,
                                      "kind": "LinkedField",
                                      "name": "azureClientId",
                                      "plural": false,
                                      "selections": (v3/*: any*/),
                                      "storageKey": null
                                    },
                                    {
                                      "alias": null,
                                      "args": null,
                                      "concreteType": null,
                                      "kind": "LinkedField",
                                      "name": "azureClientSecret",
                                      "plural": false,
                                      "selections": (v3/*: any*/),
                                      "storageKey": null
                                    },
                                    {
                                      "alias": null,
                                      "args": null,
                                      "concreteType": null,
                                      "kind": "LinkedField",
                                      "name": "scope",
                                      "plural": false,
                                      "selections": (v3/*: any*/),
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
                                  "selections": (v3/*: any*/),
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": null,
                                  "kind": "LinkedField",
                                  "name": "azureEndpoint",
                                  "plural": false,
                                  "selections": (v3/*: any*/),
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": null,
                                  "kind": "LinkedField",
                                  "name": "azureDeployment",
                                  "plural": false,
                                  "selections": (v3/*: any*/),
                                  "storageKey": null
                                },
                                (v7/*: any*/)
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
                              "selections": (v5/*: any*/),
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
                                (v6/*: any*/),
                                (v7/*: any*/)
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
                                  "selections": (v3/*: any*/),
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": null,
                                  "kind": "LinkedField",
                                  "name": "awsSecretAccessKey",
                                  "plural": false,
                                  "selections": (v3/*: any*/),
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": null,
                                  "kind": "LinkedField",
                                  "name": "awsSessionToken",
                                  "plural": false,
                                  "selections": (v3/*: any*/),
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
                                  "selections": (v3/*: any*/),
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
                              "selections": (v5/*: any*/),
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
                                    (v6/*: any*/),
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
                              "selections": (v5/*: any*/),
                              "storageKey": null
                            },
                            (v8/*: any*/)
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
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            (v8/*: any*/)
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
                              "selections": (v5/*: any*/),
                              "storageKey": null
                            },
                            (v8/*: any*/)
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
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
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
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "3fd890ffee486a290bdcc02f64ef7947";

export default node;
