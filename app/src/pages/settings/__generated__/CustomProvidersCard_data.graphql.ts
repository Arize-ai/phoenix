/**
 * @generated SignedSource<<2f0aba9add88010d1d6e61894ea18bfb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI";
import { FragmentRefs } from "relay-runtime";
export type CustomProvidersCard_data$data = {
  readonly generativeModelCustomProviders: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly config?: {
          readonly anthropicAuthenticationMethod?: {
            readonly apiKey: string | null;
          };
          readonly anthropicClientKwargs?: {
            readonly baseUrl: string | null;
            readonly defaultHeaders: any | null;
          } | null;
          readonly awsBedrockAuthenticationMethod?: {
            readonly awsAccessKeyId: string | null;
            readonly awsSecretAccessKey: string | null;
            readonly awsSessionToken: string | null;
          };
          readonly awsBedrockClientKwargs?: {
            readonly endpointUrl: string | null;
            readonly regionName: string | null;
          } | null;
          readonly azureOpenaiAuthenticationMethod?: {
            readonly apiKey: string | null;
            readonly azureAdTokenProvider: {
              readonly azureClientId: string | null;
              readonly azureClientSecret: string | null;
              readonly azureTenantId: string | null;
              readonly scope: string | null;
            } | null;
          };
          readonly azureOpenaiClientKwargs?: {
            readonly apiVersion: string | null;
            readonly azureDeployment: string | null;
            readonly azureEndpoint: string | null;
            readonly defaultHeaders: any | null;
          } | null;
          readonly googleGenaiAuthenticationMethod?: {
            readonly apiKey: string | null;
          };
          readonly googleGenaiClientKwargs?: {
            readonly httpOptions: {
              readonly baseUrl: string | null;
              readonly headers: any | null;
            } | null;
          } | null;
          readonly openaiAuthenticationMethod?: {
            readonly apiKey: string | null;
          };
          readonly openaiClientKwargs?: {
            readonly baseUrl: string | null;
            readonly defaultHeaders: any | null;
            readonly organization: string | null;
            readonly project: string | null;
          } | null;
          readonly parseError?: string;
        };
        readonly createdAt: string;
        readonly description: string | null;
        readonly id: string;
        readonly name: string;
        readonly provider: string;
        readonly sdk: GenerativeModelSDK;
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
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "apiKey",
  "storageKey": null
},
v4 = [
  (v3/*: any*/)
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultHeaders",
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
                              "selections": (v4/*: any*/),
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
                                (v5/*: any*/),
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
                                (v6/*: any*/)
                              ],
                              "storageKey": null
                            }
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
                                (v3/*: any*/),
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
                                  "kind": "ScalarField",
                                  "name": "apiVersion",
                                  "storageKey": null
                                },
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
                                (v6/*: any*/)
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
                              "selections": (v4/*: any*/),
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
                                (v5/*: any*/),
                                (v6/*: any*/)
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
                              "selections": (v4/*: any*/),
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
                                    (v5/*: any*/),
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

(node as any).hash = "16a3c52f83fadebbba9c7e7a03effeed";

export default node;
