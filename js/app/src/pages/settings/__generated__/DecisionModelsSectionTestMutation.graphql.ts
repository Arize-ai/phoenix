/**
 * @generated SignedSource<<a54549992bfe79206b406175cb434bfe>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionSDK = "OPENAI" | "TYPESAFE";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type GenerativeModelCustomerProviderConfigInput = {
  anthropic?: never;
  awsBedrock?: never;
  azureOpenai?: never;
  googleGenai?: never;
  openai: OpenAICustomProviderConfigInput;
  typesafe?: never;
} | {
  anthropic?: never;
  awsBedrock?: never;
  azureOpenai: AzureOpenAICustomProviderConfigInput;
  googleGenai?: never;
  openai?: never;
  typesafe?: never;
} | {
  anthropic: AnthropicCustomProviderConfigInput;
  awsBedrock?: never;
  azureOpenai?: never;
  googleGenai?: never;
  openai?: never;
  typesafe?: never;
} | {
  anthropic?: never;
  awsBedrock: AWSBedrockCustomProviderConfigInput;
  azureOpenai?: never;
  googleGenai?: never;
  openai?: never;
  typesafe?: never;
} | {
  anthropic?: never;
  awsBedrock?: never;
  azureOpenai?: never;
  googleGenai: GoogleGenAICustomProviderConfigInput;
  openai?: never;
  typesafe?: never;
} | {
  anthropic?: never;
  awsBedrock?: never;
  azureOpenai?: never;
  googleGenai?: never;
  openai?: never;
  typesafe: TypeSafeCustomProviderConfigInput;
};
export type OpenAICustomProviderConfigInput = {
  decisionModels?: DecisionModelsConfigInput | null;
  openaiApiType?: OpenAIApiType | null;
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
export type DecisionModelsConfigInput = {
  baseUrl?: string | null;
  decisionSdk: DecisionSDK;
  modelNames?: ReadonlyArray<string> | null;
};
export type AzureOpenAICustomProviderConfigInput = {
  azureOpenaiAuthenticationMethod: AzureOpenAIAuthenticationMethodInput;
  azureOpenaiClientKwargs: AzureOpenAIClientKwargsInput;
  decisionModels?: DecisionModelsConfigInput | null;
  openaiApiType?: OpenAIApiType | null;
};
export type AzureOpenAIAuthenticationMethodInput = {
  apiKey: string;
  azureAdTokenProvider?: never;
  defaultCredentials?: never;
} | {
  apiKey?: never;
  azureAdTokenProvider: AzureOpenAIADTokenProviderInput;
  defaultCredentials?: never;
} | {
  apiKey?: never;
  azureAdTokenProvider?: never;
  defaultCredentials: boolean;
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
  accessKeys: AWSBedrockAccessKeysInput;
  defaultCredentials?: never;
} | {
  accessKeys?: never;
  defaultCredentials: boolean;
};
export type AWSBedrockAccessKeysInput = {
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
export type TypeSafeCustomProviderConfigInput = {
  decisionModels?: DecisionModelsConfigInput | null;
  typesafeAuthenticationMethod: TypeSafeAuthenticationMethodInput;
  typesafeClientKwargs?: TypeSafeClientKwargsInput | null;
};
export type TypeSafeAuthenticationMethodInput = {
  apiKey: string;
};
export type TypeSafeClientKwargsInput = {
  baseUrl?: string | null;
  defaultHeaders?: any | null;
};
export type DecisionModelsSectionTestMutation$variables = {
  input: GenerativeModelCustomerProviderConfigInput;
};
export type DecisionModelsSectionTestMutation$data = {
  readonly testGenerativeModelCustomProviderDecisionEndpoint: {
    readonly error: string | null;
    readonly url: string | null;
  };
};
export type DecisionModelsSectionTestMutation = {
  response: DecisionModelsSectionTestMutation$data;
  variables: DecisionModelsSectionTestMutation$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "TestGenerativeModelCustomProviderDecisionEndpointResult",
    "kind": "LinkedField",
    "name": "testGenerativeModelCustomProviderDecisionEndpoint",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "error",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "url",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionModelsSectionTestMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DecisionModelsSectionTestMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "ea55f6bcb2085efb5e42a941e7571c4b",
    "id": null,
    "metadata": {},
    "name": "DecisionModelsSectionTestMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionModelsSectionTestMutation(\n  $input: GenerativeModelCustomerProviderConfigInput!\n) {\n  testGenerativeModelCustomProviderDecisionEndpoint(input: $input) {\n    error\n    url\n  }\n}\n"
  }
};
})();

(node as any).hash = "b5a4ac9074bfa32422898b70c88fd8f7";

export default node;
