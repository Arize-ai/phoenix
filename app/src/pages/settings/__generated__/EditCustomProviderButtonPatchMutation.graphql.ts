/**
 * @generated SignedSource<<efd1e16716c821b9cf69882611e39aed>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI";
export type PatchGenerativeModelCustomProviderMutationInput = {
  clientConfig?: GenerativeModelCustomerProviderConfigInput | null;
  description?: string | null;
  id: string;
  name?: string | null;
  provider?: string | null;
};
export type GenerativeModelCustomerProviderConfigInput = {
  anthropic?: AnthropicCustomProviderConfigInput | null;
  awsBedrock?: AWSBedrockCustomProviderConfigInput | null;
  azureOpenai?: AzureOpenAICustomProviderConfigInput | null;
  googleGenai?: GoogleGenAICustomProviderConfigInput | null;
  openai?: OpenAICustomProviderConfigInput | null;
};
export type OpenAICustomProviderConfigInput = {
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
};
export type AzureOpenAIAuthenticationMethodInput = {
  apiKey?: string | null;
  azureAdTokenProvider?: AzureOpenAIADTokenProviderInput | null;
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
export type EditCustomProviderButtonPatchMutation$variables = {
  input: PatchGenerativeModelCustomProviderMutationInput;
};
export type EditCustomProviderButtonPatchMutation$data = {
  readonly patchGenerativeModelCustomProvider: {
    readonly provider: {
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
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProvider",
  "kind": "LinkedField",
  "name": "provider",
  "plural": false,
  "selections": [
    (v2/*: any*/),
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
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditCustomProviderButtonPatchMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PatchGenerativeModelCustomProviderMutationPayload",
        "kind": "LinkedField",
        "name": "patchGenerativeModelCustomProvider",
        "plural": false,
        "selections": [
          (v10/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditCustomProviderButtonPatchMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PatchGenerativeModelCustomProviderMutationPayload",
        "kind": "LinkedField",
        "name": "patchGenerativeModelCustomProvider",
        "plural": false,
        "selections": [
          (v10/*: any*/),
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
                              (v12/*: any*/),
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
                              }
                            ],
                            "storageKey": null
                          },
                          (v12/*: any*/)
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
                "args": (v11/*: any*/),
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
    "cacheID": "f20ba75812dc0b1e7b9c58b07de1a39e",
    "id": null,
    "metadata": {},
    "name": "EditCustomProviderButtonPatchMutation",
    "operationKind": "mutation",
    "text": "mutation EditCustomProviderButtonPatchMutation(\n  $input: PatchGenerativeModelCustomProviderMutationInput!\n) {\n  patchGenerativeModelCustomProvider(input: $input) {\n    provider {\n      id\n      name\n      description\n      sdk\n      provider\n      createdAt\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n    }\n    query {\n      ...CustomProvidersCard_data\n    }\n  }\n}\n\nfragment CustomProvidersCard_data on Query {\n  generativeModelCustomProviders(first: 50) {\n    edges {\n      node {\n        id\n        name\n        description\n        sdk\n        provider\n        createdAt\n        updatedAt\n        user {\n          id\n          username\n          profilePictureUrl\n        }\n        config {\n          __typename\n          ... on UnparsableConfig {\n            parseError\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f83fe12b75d5555bd263598ea93480c0";

export default node;
