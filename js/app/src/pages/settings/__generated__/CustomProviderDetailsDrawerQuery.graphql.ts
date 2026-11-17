/**
 * @generated SignedSource<<dea4c5cdc37da9596da053407a15a26f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CustomProviderDetailsDrawerQuery$variables = {
  id: string;
};
export type CustomProviderDetailsDrawerQuery$data = {
  readonly node: {
    readonly __typename: "GenerativeModelCustomProvider";
    readonly " $fragmentSpreads": FragmentRefs<"CustomProviderDetailsDrawer_provider">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type CustomProviderDetailsDrawerQuery = {
  response: CustomProviderDetailsDrawerQuery$data;
  variables: CustomProviderDetailsDrawerQuery$variables;
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
v4 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "names",
    "storageKey": null
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "openaiApiType",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "apiKey",
  "storageKey": null
},
v7 = [
  (v6/*:: as any*/)
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultHeaders",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultCredentials",
  "storageKey": null
},
v11 = [
  (v8/*:: as any*/),
  (v9/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CustomProviderDetailsDrawerQuery",
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
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "CustomProviderDetailsDrawer_provider"
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
    "name": "CustomProviderDetailsDrawerQuery",
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
                  },
                  (v3/*:: as any*/)
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
                    "selections": (v4/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ModelsOfType",
                    "kind": "LinkedField",
                    "name": "decision",
                    "plural": false,
                    "selections": (v4/*:: as any*/),
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
                  (v2/*:: as any*/),
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
                      (v5/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "OpenAIAuthenticationMethod",
                        "kind": "LinkedField",
                        "name": "openaiAuthenticationMethod",
                        "plural": false,
                        "selections": (v7/*:: as any*/),
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
                          (v8/*:: as any*/),
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
                          (v9/*:: as any*/)
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
                      (v5/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "AzureOpenAIAuthenticationMethod",
                        "kind": "LinkedField",
                        "name": "azureOpenaiAuthenticationMethod",
                        "plural": false,
                        "selections": [
                          (v6/*:: as any*/),
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
                          (v10/*:: as any*/)
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
                          (v9/*:: as any*/)
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
                        "selections": (v7/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "AnthropicClientKwargs",
                        "kind": "LinkedField",
                        "name": "anthropicClientKwargs",
                        "plural": false,
                        "selections": (v11/*:: as any*/),
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
                          (v10/*:: as any*/)
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
                        "selections": (v7/*:: as any*/),
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
                              (v8/*:: as any*/),
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
                        "selections": (v7/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "TypeSafeClientKwargs",
                        "kind": "LinkedField",
                        "name": "typesafeClientKwargs",
                        "plural": false,
                        "selections": (v11/*:: as any*/),
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "55bb577538d3792354700028b77cbe55",
    "id": null,
    "metadata": {},
    "name": "CustomProviderDetailsDrawerQuery",
    "operationKind": "query",
    "text": "query CustomProviderDetailsDrawerQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on GenerativeModelCustomProvider {\n      ...CustomProviderDetailsDrawer_provider\n    }\n    id\n  }\n}\n\nfragment CustomProviderDetailsDrawer_provider on GenerativeModelCustomProvider {\n  id\n  name\n  description\n  provider\n  sdk\n  createdAt\n  updatedAt\n  user {\n    username\n    id\n  }\n  modelTypes\n  models {\n    chat {\n      names\n    }\n    decision {\n      names\n    }\n  }\n  chatModelNames: modelNames(modelType: CHAT)\n  decisionModelNames: modelNames(modelType: DECISION)\n  config {\n    __typename\n    ... on UnparsableConfig {\n      parseError\n    }\n    ... on OpenAICustomProviderConfig {\n      openaiApiType\n      openaiAuthenticationMethod {\n        apiKey\n      }\n      openaiClientKwargs {\n        baseUrl\n        organization\n        project\n        defaultHeaders\n      }\n    }\n    ... on AzureOpenAICustomProviderConfig {\n      openaiApiType\n      azureOpenaiAuthenticationMethod {\n        apiKey\n        azureAdTokenProvider {\n          azureTenantId\n          azureClientId\n          azureClientSecret\n          scope\n        }\n        defaultCredentials\n      }\n      azureOpenaiClientKwargs {\n        azureEndpoint\n        defaultHeaders\n      }\n    }\n    ... on AnthropicCustomProviderConfig {\n      anthropicAuthenticationMethod {\n        apiKey\n      }\n      anthropicClientKwargs {\n        baseUrl\n        defaultHeaders\n      }\n    }\n    ... on AWSBedrockCustomProviderConfig {\n      awsBedrockAuthenticationMethod {\n        accessKeys {\n          awsAccessKeyId\n          awsSecretAccessKey\n          awsSessionToken\n        }\n        defaultCredentials\n      }\n      awsBedrockClientKwargs {\n        regionName\n        endpointUrl\n      }\n    }\n    ... on GoogleGenAICustomProviderConfig {\n      googleGenaiAuthenticationMethod {\n        apiKey\n      }\n      googleGenaiClientKwargs {\n        httpOptions {\n          baseUrl\n          headers\n        }\n      }\n    }\n    ... on TypeSafeCustomProviderConfig {\n      typesafeAuthenticationMethod {\n        apiKey\n      }\n      typesafeClientKwargs {\n        baseUrl\n        defaultHeaders\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9dde3c6e96d4918e72de42348caa4029";

export default node;
