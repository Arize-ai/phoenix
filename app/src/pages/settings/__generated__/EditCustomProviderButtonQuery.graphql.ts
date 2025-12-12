/**
 * @generated SignedSource<<9f0e317335c419bdb33be6c3be73cd1a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI";
export type EditCustomProviderButtonQuery$variables = {
  id: string;
};
export type EditCustomProviderButtonQuery$data = {
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
        readonly awsAccessKeyId: string;
        readonly awsSecretAccessKey: string;
        readonly awsSessionToken: string | null;
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
      };
      readonly azureOpenaiClientKwargs?: {
        readonly apiVersion: string;
        readonly azureDeployment: string;
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
    readonly createdAt?: string;
    readonly description?: string | null;
    readonly id?: string;
    readonly name?: string;
    readonly provider?: string;
    readonly sdk?: GenerativeModelSDK;
    readonly updatedAt?: string;
    readonly user?: {
      readonly id: string;
      readonly profilePictureUrl: string | null;
      readonly username: string;
    } | null;
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
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "user",
  "plural": false,
  "selections": [
    (v2/*: any*/),
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
v10 = {
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
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "apiKey",
  "storageKey": null
},
v12 = [
  (v11/*: any*/)
],
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "OpenAIAuthenticationMethod",
      "kind": "LinkedField",
      "name": "openaiAuthenticationMethod",
      "plural": false,
      "selections": (v12/*: any*/),
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
        (v14/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "OpenAICustomProviderConfig",
  "abstractKey": null
},
v16 = {
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
        (v11/*: any*/),
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
        (v14/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "AzureOpenAICustomProviderConfig",
  "abstractKey": null
},
v17 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "AnthropicAuthenticationMethod",
      "kind": "LinkedField",
      "name": "anthropicAuthenticationMethod",
      "plural": false,
      "selections": (v12/*: any*/),
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
        (v13/*: any*/),
        (v14/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "AnthropicCustomProviderConfig",
  "abstractKey": null
},
v18 = {
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
},
v19 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "GoogleGenAIAuthenticationMethod",
      "kind": "LinkedField",
      "name": "googleGenaiAuthenticationMethod",
      "plural": false,
      "selections": (v12/*: any*/),
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
            (v13/*: any*/),
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
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditCustomProviderButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v10/*: any*/),
                  (v15/*: any*/)
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
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v10/*: any*/),
                  (v16/*: any*/)
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
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v10/*: any*/),
                  (v17/*: any*/)
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
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v10/*: any*/),
                  (v18/*: any*/)
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
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v10/*: any*/),
                  (v19/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "GenerativeModelCustomProviderGoogleGenAI",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditCustomProviderButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v20/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v20/*: any*/),
                  (v10/*: any*/),
                  (v15/*: any*/)
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
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v20/*: any*/),
                  (v10/*: any*/),
                  (v16/*: any*/)
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
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v20/*: any*/),
                  (v10/*: any*/),
                  (v17/*: any*/)
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
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v20/*: any*/),
                  (v10/*: any*/),
                  (v18/*: any*/)
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
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "config",
                "plural": false,
                "selections": [
                  (v20/*: any*/),
                  (v10/*: any*/),
                  (v19/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "GenerativeModelCustomProviderGoogleGenAI",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "980785c564256ddc2bc81b4640dd3e46",
    "id": null,
    "metadata": {},
    "name": "EditCustomProviderButtonQuery",
    "operationKind": "query",
    "text": "query EditCustomProviderButtonQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on GenerativeModelCustomProviderOpenAI {\n      id\n      name\n      description\n      sdk\n      provider\n      createdAt\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n      config {\n        __typename\n        ... on UnparsableConfig {\n          parseError\n        }\n        ... on OpenAICustomProviderConfig {\n          openaiAuthenticationMethod {\n            apiKey\n          }\n          openaiClientKwargs {\n            baseUrl\n            organization\n            project\n            defaultHeaders\n          }\n        }\n      }\n    }\n    ... on GenerativeModelCustomProviderAzureOpenAI {\n      id\n      name\n      description\n      sdk\n      provider\n      createdAt\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n      config {\n        __typename\n        ... on UnparsableConfig {\n          parseError\n        }\n        ... on AzureOpenAICustomProviderConfig {\n          azureOpenaiAuthenticationMethod {\n            apiKey\n            azureAdTokenProvider {\n              azureTenantId\n              azureClientId\n              azureClientSecret\n              scope\n            }\n          }\n          azureOpenaiClientKwargs {\n            apiVersion\n            azureEndpoint\n            azureDeployment\n            defaultHeaders\n          }\n        }\n      }\n    }\n    ... on GenerativeModelCustomProviderAnthropic {\n      id\n      name\n      description\n      sdk\n      provider\n      createdAt\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n      config {\n        __typename\n        ... on UnparsableConfig {\n          parseError\n        }\n        ... on AnthropicCustomProviderConfig {\n          anthropicAuthenticationMethod {\n            apiKey\n          }\n          anthropicClientKwargs {\n            baseUrl\n            defaultHeaders\n          }\n        }\n      }\n    }\n    ... on GenerativeModelCustomProviderAWSBedrock {\n      id\n      name\n      description\n      sdk\n      provider\n      createdAt\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n      config {\n        __typename\n        ... on UnparsableConfig {\n          parseError\n        }\n        ... on AWSBedrockCustomProviderConfig {\n          awsBedrockAuthenticationMethod {\n            awsAccessKeyId\n            awsSecretAccessKey\n            awsSessionToken\n          }\n          awsBedrockClientKwargs {\n            regionName\n            endpointUrl\n          }\n        }\n      }\n    }\n    ... on GenerativeModelCustomProviderGoogleGenAI {\n      id\n      name\n      description\n      sdk\n      provider\n      createdAt\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n      config {\n        __typename\n        ... on UnparsableConfig {\n          parseError\n        }\n        ... on GoogleGenAICustomProviderConfig {\n          googleGenaiAuthenticationMethod {\n            apiKey\n          }\n          googleGenaiClientKwargs {\n            httpOptions {\n              baseUrl\n              headers\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "48c7ffc63f0f72c3b4d599f631d627be";

export default node;
