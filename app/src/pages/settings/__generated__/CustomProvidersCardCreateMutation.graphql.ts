/**
 * @generated SignedSource<<261f632c6947cd0243a86ecc03ad42b4>>
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
export type CustomProvidersCardCreateMutation$variables = {
  connectionId: string;
  input: CreateGenerativeModelCustomProviderMutationInput;
};
export type CustomProvidersCardCreateMutation$data = {
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
export type CustomProvidersCardCreateMutation = {
  response: CustomProvidersCardCreateMutation$data;
  variables: CustomProvidersCardCreateMutation$variables;
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
v10 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "__typename",
    "storageKey": null
  },
  (v3/*: any*/),
  (v4/*: any*/),
  (v5/*: any*/),
  (v6/*: any*/),
  (v7/*: any*/),
  (v8/*: any*/),
  (v9/*: any*/)
],
v11 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "CustomProvidersCardCreateMutation",
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
    "name": "CustomProvidersCardCreateMutation",
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
            "selections": (v10/*: any*/),
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
                        "selections": (v10/*: any*/),
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
    "cacheID": "ff4cc1cbdb8ee530ae7714a2db413928",
    "id": null,
    "metadata": {},
    "name": "CustomProvidersCardCreateMutation",
    "operationKind": "mutation",
    "text": "mutation CustomProvidersCardCreateMutation(\n  $input: CreateGenerativeModelCustomProviderMutationInput!\n) {\n  createGenerativeModelCustomProvider(input: $input) {\n    provider {\n      __typename\n      id\n      name\n      description\n      provider\n      createdAt\n      updatedAt\n      dependencies {\n        package\n        minimumVersion\n        installedVersion\n      }\n    }\n    query {\n      ...CustomProvidersCard_data\n    }\n  }\n}\n\nfragment CustomProvidersCard_data on Query {\n  GenerativeModelCustomProviders(first: 50) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        description\n        provider\n        createdAt\n        updatedAt\n        dependencies {\n          package\n          minimumVersion\n          installedVersion\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a4c82b1d7083d60be036edca445be385";

export default node;
