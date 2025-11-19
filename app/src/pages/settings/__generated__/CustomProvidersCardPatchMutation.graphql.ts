/**
 * @generated SignedSource<<bd09257b1774783fe8cbd412432aca17>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
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
export type CustomProvidersCardPatchMutation$variables = {
  input: PatchGenerativeModelCustomProviderMutationInput;
};
export type CustomProvidersCardPatchMutation$data = {
  readonly patchGenerativeModelCustomProvider: {
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
export type CustomProvidersCardPatchMutation = {
  response: CustomProvidersCardPatchMutation$data;
  variables: CustomProvidersCardPatchMutation$variables;
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
  "name": "provider",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v8 = {
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
v9 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "__typename",
    "storageKey": null
  },
  (v2/*: any*/),
  (v3/*: any*/),
  (v4/*: any*/),
  (v5/*: any*/),
  (v6/*: any*/),
  (v7/*: any*/),
  (v8/*: any*/)
],
v10 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CustomProvidersCardPatchMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PatchGenerativeModelCustomProviderMutationPayload",
        "kind": "LinkedField",
        "name": "patchGenerativeModelCustomProvider",
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
              (v2/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CustomProvidersCardPatchMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PatchGenerativeModelCustomProviderMutationPayload",
        "kind": "LinkedField",
        "name": "patchGenerativeModelCustomProvider",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "provider",
            "plural": false,
            "selections": (v9/*: any*/),
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
                "args": (v10/*: any*/),
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
                        "selections": (v9/*: any*/),
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
                "args": (v10/*: any*/),
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
    "cacheID": "7d59de5affc290b25fd86e6f8b1bce82",
    "id": null,
    "metadata": {},
    "name": "CustomProvidersCardPatchMutation",
    "operationKind": "mutation",
    "text": "mutation CustomProvidersCardPatchMutation(\n  $input: PatchGenerativeModelCustomProviderMutationInput!\n) {\n  patchGenerativeModelCustomProvider(input: $input) {\n    provider {\n      __typename\n      id\n      name\n      description\n      provider\n      createdAt\n      updatedAt\n      dependencies {\n        package\n        minimumVersion\n        installedVersion\n      }\n    }\n    query {\n      ...CustomProvidersCard_data\n    }\n  }\n}\n\nfragment CustomProvidersCard_data on Query {\n  GenerativeModelCustomProviders(first: 50) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        description\n        provider\n        createdAt\n        updatedAt\n        dependencies {\n          package\n          minimumVersion\n          installedVersion\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ac2df134d1ed5cb1fdf99e3dd9f03895";

export default node;
