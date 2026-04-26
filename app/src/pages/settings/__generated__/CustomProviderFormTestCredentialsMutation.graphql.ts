/**
 * @generated SignedSource<<542ea59620127fb6e3a68057d18cfd45>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type GenerativeModelCustomerProviderConfigInput = {
  anthropic?: AnthropicCustomProviderConfigInput | null;
  awsBedrock?: AWSBedrockCustomProviderConfigInput | null;
  azureOpenai?: AzureOpenAICustomProviderConfigInput | null;
  googleGenai?: GoogleGenAICustomProviderConfigInput | null;
  openai?: OpenAICustomProviderConfigInput | null;
};
export type OpenAICustomProviderConfigInput = {
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
export type AzureOpenAICustomProviderConfigInput = {
  azureOpenaiAuthenticationMethod: AzureOpenAIAuthenticationMethodInput;
  azureOpenaiClientKwargs: AzureOpenAIClientKwargsInput;
  openaiApiType?: OpenAIApiType | null;
};
export type AzureOpenAIAuthenticationMethodInput = {
  apiKey?: string | null;
  azureAdTokenProvider?: AzureOpenAIADTokenProviderInput | null;
  defaultCredentials?: boolean | null;
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
  accessKeys?: AWSBedrockAccessKeysInput | null;
  defaultCredentials?: boolean | null;
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
export type CustomProviderFormTestCredentialsMutation$variables = {
  input: GenerativeModelCustomerProviderConfigInput;
};
export type CustomProviderFormTestCredentialsMutation$data = {
  readonly testGenerativeModelCustomProviderCredentials: {
    readonly error: string | null;
  };
};
export type CustomProviderFormTestCredentialsMutation = {
  response: CustomProviderFormTestCredentialsMutation$data;
  variables: CustomProviderFormTestCredentialsMutation$variables;
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
    "concreteType": "TestGenerativeModelCustomProviderCredentialsResult",
    "kind": "LinkedField",
    "name": "testGenerativeModelCustomProviderCredentials",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "error",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CustomProviderFormTestCredentialsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CustomProviderFormTestCredentialsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "7680aac239abb387cb84f787e2b9c2dc",
    "id": null,
    "metadata": {},
    "name": "CustomProviderFormTestCredentialsMutation",
    "operationKind": "mutation",
    "text": "mutation CustomProviderFormTestCredentialsMutation(\n  $input: GenerativeModelCustomerProviderConfigInput!\n) {\n  testGenerativeModelCustomProviderCredentials(input: $input) {\n    error\n  }\n}\n"
  }
};
})();

(node as any).hash = "dff7b8eedafccb0a37f2748ccb1a7be6";

export default node;
