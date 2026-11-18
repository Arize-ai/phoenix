/**
 * @generated SignedSource<<42553d59229c9b7c4f2b0715053c05d9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI" | "TYPESAFE";
export type ModelType = "CHAT" | "DECISION";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
import { FragmentRefs } from "relay-runtime";
export type CustomProviderDetailsDrawer_provider$data = {
  readonly chatModelNames: ReadonlyArray<string>;
  readonly config: {
    readonly __typename: "AWSBedrockCustomProviderConfig";
    readonly awsBedrockAuthenticationMethod: {
      readonly accessKeys: {
        readonly awsAccessKeyId: string;
        readonly awsSecretAccessKey: string;
        readonly awsSessionToken: string | null;
      } | null;
      readonly defaultCredentials: boolean | null;
    };
    readonly awsBedrockClientKwargs: {
      readonly endpointUrl: string | null;
      readonly regionName: string;
    };
  } | {
    readonly __typename: "AnthropicCustomProviderConfig";
    readonly anthropicAuthenticationMethod: {
      readonly apiKey: string | null;
    };
    readonly anthropicClientKwargs: {
      readonly baseUrl: string | null;
      readonly defaultHeaders: any | null;
    } | null;
  } | {
    readonly __typename: "AzureOpenAICustomProviderConfig";
    readonly azureOpenaiAuthenticationMethod: {
      readonly apiKey: string | null;
      readonly azureAdTokenProvider: {
        readonly azureClientId: string;
        readonly azureClientSecret: string;
        readonly azureTenantId: string;
        readonly scope: string;
      } | null;
      readonly defaultCredentials: boolean | null;
    };
    readonly azureOpenaiClientKwargs: {
      readonly azureEndpoint: string;
      readonly defaultHeaders: any | null;
    };
    readonly openaiApiType: OpenAIApiType;
  } | {
    readonly __typename: "GoogleGenAICustomProviderConfig";
    readonly googleGenaiAuthenticationMethod: {
      readonly apiKey: string | null;
    };
    readonly googleGenaiClientKwargs: {
      readonly httpOptions: {
        readonly baseUrl: string | null;
        readonly headers: any | null;
      } | null;
    } | null;
  } | {
    readonly __typename: "OpenAICustomProviderConfig";
    readonly openaiApiType: OpenAIApiType;
    readonly openaiAuthenticationMethod: {
      readonly apiKey: string | null;
    };
    readonly openaiClientKwargs: {
      readonly baseUrl: string | null;
      readonly defaultHeaders: any | null;
      readonly organization: string | null;
      readonly project: string | null;
    } | null;
  } | {
    readonly __typename: "TypeSafeCustomProviderConfig";
    readonly typesafeAuthenticationMethod: {
      readonly apiKey: string | null;
    };
    readonly typesafeClientKwargs: {
      readonly baseUrl: string | null;
      readonly defaultHeaders: any | null;
    } | null;
  } | {
    readonly __typename: "UnparsableConfig";
    readonly parseError: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly createdAt: string;
  readonly decisionModelNames: ReadonlyArray<string>;
  readonly description: string | null;
  readonly id: string;
  readonly modelTypes: ReadonlyArray<ModelType>;
  readonly models: {
    readonly chat: {
      readonly names: ReadonlyArray<string>;
    } | null;
    readonly decision: {
      readonly names: ReadonlyArray<string>;
    } | null;
  };
  readonly name: string;
  readonly provider: string;
  readonly sdk: GenerativeModelSDK;
  readonly updatedAt: string;
  readonly user: {
    readonly username: string;
  } | null;
  readonly " $fragmentType": "CustomProviderDetailsDrawer_provider";
};
export type CustomProviderDetailsDrawer_provider$key = {
  readonly " $data"?: CustomProviderDetailsDrawer_provider$data;
  readonly " $fragmentSpreads": FragmentRefs<"CustomProviderDetailsDrawer_provider">;
};

const node: ReaderFragment = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "names",
    "storageKey": null
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "openaiApiType",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "apiKey",
  "storageKey": null
},
v3 = [
  (v2/*:: as any*/)
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultHeaders",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultCredentials",
  "storageKey": null
},
v7 = [
  (v4/*:: as any*/),
  (v5/*:: as any*/)
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "CustomProviderDetailsDrawer_provider",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
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
      "name": "provider",
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
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "username",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "modelTypes",
      "storageKey": null
    },
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
          "selections": (v0/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "ModelsOfType",
          "kind": "LinkedField",
          "name": "decision",
          "plural": false,
          "selections": (v0/*:: as any*/),
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
    {
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
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "config",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "__typename",
          "storageKey": null
        },
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
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v1/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": "OpenAIAuthenticationMethod",
              "kind": "LinkedField",
              "name": "openaiAuthenticationMethod",
              "plural": false,
              "selections": (v3/*:: as any*/),
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
                (v4/*:: as any*/),
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
                (v5/*:: as any*/)
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
            (v1/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": "AzureOpenAIAuthenticationMethod",
              "kind": "LinkedField",
              "name": "azureOpenaiAuthenticationMethod",
              "plural": false,
              "selections": [
                (v2/*:: as any*/),
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
                (v6/*:: as any*/)
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
                (v5/*:: as any*/)
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
              "selections": (v3/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "AnthropicClientKwargs",
              "kind": "LinkedField",
              "name": "anthropicClientKwargs",
              "plural": false,
              "selections": (v7/*:: as any*/),
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
                (v6/*:: as any*/)
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
              "selections": (v3/*:: as any*/),
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
                    (v4/*:: as any*/),
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
              "selections": (v3/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "TypeSafeClientKwargs",
              "kind": "LinkedField",
              "name": "typesafeClientKwargs",
              "plural": false,
              "selections": (v7/*:: as any*/),
              "storageKey": null
            }
          ],
          "type": "TypeSafeCustomProviderConfig",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "GenerativeModelCustomProvider",
  "abstractKey": null
};
})();

(node as any).hash = "5223240ca47d616e0283c8485f6c1c41";

export default node;
