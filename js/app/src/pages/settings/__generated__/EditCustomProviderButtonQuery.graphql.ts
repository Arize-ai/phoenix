/**
 * @generated SignedSource<<016a49e164b5c869e85de3b73f3011b3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI" | "TYPESAFE";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type EditCustomProviderButtonQuery$variables = {
  id: string;
};
export type EditCustomProviderButtonQuery$data = {
  readonly node: {
    readonly __typename: "GenerativeModelCustomProvider";
    readonly config: {
      readonly anthropicAuthenticationMethod?: {
        readonly apiKey: string | null;
      };
      readonly anthropicClientKwargs?: {
        readonly baseUrl: string | null;
        readonly defaultHeaders: any | null;
      } | null;
      readonly awsBedrockAuthenticationMethod?: {
        readonly accessKeys: {
          readonly awsAccessKeyId: string;
          readonly awsSecretAccessKey: string;
          readonly awsSessionToken: string | null;
        } | null;
        readonly defaultCredentials: boolean | null;
      };
      readonly awsBedrockClientKwargs?: {
        readonly endpointUrl: string | null;
        readonly regionName: string;
      };
      readonly azureOpenaiAuthenticationMethod?: {
        readonly apiKey: string | null;
        readonly azureAdTokenProvider: {
          readonly azureClientId: string;
          readonly azureClientSecret: string;
          readonly azureTenantId: string;
          readonly scope: string;
        } | null;
        readonly defaultCredentials: boolean | null;
      };
      readonly azureOpenaiClientKwargs?: {
        readonly azureEndpoint: string;
        readonly defaultHeaders: any | null;
      };
      readonly googleGenaiAuthenticationMethod?: {
        readonly apiKey: string | null;
      };
      readonly googleGenaiClientKwargs?: {
        readonly httpOptions: {
          readonly baseUrl: string | null;
          readonly headers: any | null;
        } | null;
      } | null;
      readonly openaiApiType?: OpenAIApiType;
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
      readonly typesafeAuthenticationMethod?: {
        readonly apiKey: string | null;
      };
      readonly typesafeClientKwargs?: {
        readonly baseUrl: string | null;
        readonly defaultHeaders: any | null;
      } | null;
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
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type EditCustomProviderButtonQuery = {
  response: EditCustomProviderButtonQuery$data;
  variables: EditCustomProviderButtonQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
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
  "name": "sdk",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "provider",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "user",
  "plural": false,
  "selections": [
    (v3/*:: as any*/),
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
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "openaiApiType",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "apiKey",
  "storageKey": null
},
v14 = [
  (v13/*:: as any*/)
],
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
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
  "kind": "InlineFragment",
  "selections": [
    (v12/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "OpenAIAuthenticationMethod",
      "kind": "LinkedField",
      "name": "openaiAuthenticationMethod",
      "plural": false,
      "selections": (v14/*:: as any*/),
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
        (v15/*:: as any*/),
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
        (v16/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "OpenAICustomProviderConfig",
  "abstractKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultCredentials",
  "storageKey": null
},
v19 = {
  "kind": "InlineFragment",
  "selections": [
    (v12/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "AzureOpenAIAuthenticationMethod",
      "kind": "LinkedField",
      "name": "azureOpenaiAuthenticationMethod",
      "plural": false,
      "selections": [
        (v13/*:: as any*/),
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
        (v18/*:: as any*/)
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
        (v16/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "AzureOpenAICustomProviderConfig",
  "abstractKey": null
},
v20 = [
  (v15/*:: as any*/),
  (v16/*:: as any*/)
],
v21 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "AnthropicAuthenticationMethod",
      "kind": "LinkedField",
      "name": "anthropicAuthenticationMethod",
      "plural": false,
      "selections": (v14/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "AnthropicClientKwargs",
      "kind": "LinkedField",
      "name": "anthropicClientKwargs",
      "plural": false,
      "selections": (v20/*:: as any*/),
      "storageKey": null
    }
  ],
  "type": "AnthropicCustomProviderConfig",
  "abstractKey": null
},
v22 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "TypeSafeAuthenticationMethod",
      "kind": "LinkedField",
      "name": "typesafeAuthenticationMethod",
      "plural": false,
      "selections": (v14/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "TypeSafeClientKwargs",
      "kind": "LinkedField",
      "name": "typesafeClientKwargs",
      "plural": false,
      "selections": (v20/*:: as any*/),
      "storageKey": null
    }
  ],
  "type": "TypeSafeCustomProviderConfig",
  "abstractKey": null
},
v23 = {
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
        (v18/*:: as any*/)
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
v24 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "GoogleGenAIAuthenticationMethod",
      "kind": "LinkedField",
      "name": "googleGenaiAuthenticationMethod",
      "plural": false,
      "selections": (v14/*:: as any*/),
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
            (v15/*:: as any*/),
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditCustomProviderButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v11/*:: as any*/),
                  (v17/*:: as any*/),
                  (v19/*:: as any*/),
                  (v21/*:: as any*/),
                  (v22/*:: as any*/),
                  (v23/*:: as any*/),
                  (v24/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "GenerativeModelCustomProvider",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditCustomProviderButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v11/*:: as any*/),
                  (v17/*:: as any*/),
                  (v19/*:: as any*/),
                  (v21/*:: as any*/),
                  (v22/*:: as any*/),
                  (v23/*:: as any*/),
                  (v24/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "GenerativeModelCustomProvider",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ca5a76fc1fbc1b7e226e9421cc7d822b",
    "id": null,
    "metadata": {},
    "name": "EditCustomProviderButtonQuery",
    "operationKind": "query",
    "text": "query EditCustomProviderButtonQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on GenerativeModelCustomProvider {\n      id\n      name\n      description\n      sdk\n      provider\n      createdAt\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n      config {\n        __typename\n        ... on UnparsableConfig {\n          parseError\n        }\n        ... on OpenAICustomProviderConfig {\n          openaiApiType\n          openaiAuthenticationMethod {\n            apiKey\n          }\n          openaiClientKwargs {\n            baseUrl\n            organization\n            project\n            defaultHeaders\n          }\n        }\n        ... on AzureOpenAICustomProviderConfig {\n          openaiApiType\n          azureOpenaiAuthenticationMethod {\n            apiKey\n            azureAdTokenProvider {\n              azureTenantId\n              azureClientId\n              azureClientSecret\n              scope\n            }\n            defaultCredentials\n          }\n          azureOpenaiClientKwargs {\n            azureEndpoint\n            defaultHeaders\n          }\n        }\n        ... on AnthropicCustomProviderConfig {\n          anthropicAuthenticationMethod {\n            apiKey\n          }\n          anthropicClientKwargs {\n            baseUrl\n            defaultHeaders\n          }\n        }\n        ... on TypeSafeCustomProviderConfig {\n          typesafeAuthenticationMethod {\n            apiKey\n          }\n          typesafeClientKwargs {\n            baseUrl\n            defaultHeaders\n          }\n        }\n        ... on AWSBedrockCustomProviderConfig {\n          awsBedrockAuthenticationMethod {\n            accessKeys {\n              awsAccessKeyId\n              awsSecretAccessKey\n              awsSessionToken\n            }\n            defaultCredentials\n          }\n          awsBedrockClientKwargs {\n            regionName\n            endpointUrl\n          }\n        }\n        ... on GoogleGenAICustomProviderConfig {\n          googleGenaiAuthenticationMethod {\n            apiKey\n          }\n          googleGenaiClientKwargs {\n            httpOptions {\n              baseUrl\n              headers\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "a0c576c8ee6c6cd925fc3783c883383d";

export default node;
