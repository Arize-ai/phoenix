/**
 * @generated SignedSource<<8cb64d8251def8e80d7bd55f407625f5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI";
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
  apiVersion: string;
  azureDeployment: string;
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
export type NewCustomProviderButtonCreateMutation$variables = {
  connectionId: string;
  input: CreateGenerativeModelCustomProviderMutationInput;
};
export type NewCustomProviderButtonCreateMutation$data = {
  readonly createGenerativeModelCustomProvider: {
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
  };
};
export type NewCustomProviderButtonCreateMutation = {
  response: NewCustomProviderButtonCreateMutation$data;
  variables: NewCustomProviderButtonCreateMutation$variables;
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
    (v3/*: any*/),
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
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "NewCustomProviderButtonCreateMutation",
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
              (v9/*: any*/),
              (v10/*: any*/)
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
    "name": "NewCustomProviderButtonCreateMutation",
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
              (v9/*: any*/),
              (v10/*: any*/)
            ],
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5fef156adff309a1c67a67f0055e4c81",
    "id": null,
    "metadata": {},
    "name": "NewCustomProviderButtonCreateMutation",
    "operationKind": "mutation",
    "text": "mutation NewCustomProviderButtonCreateMutation(\n  $input: CreateGenerativeModelCustomProviderMutationInput!\n) {\n  createGenerativeModelCustomProvider(input: $input) {\n    provider {\n      __typename\n      id\n      name\n      description\n      sdk\n      provider\n      createdAt\n      updatedAt\n      user {\n        id\n        username\n        profilePictureUrl\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b66de5d56b0d8b2241083125c42c7b32";

export default node;
