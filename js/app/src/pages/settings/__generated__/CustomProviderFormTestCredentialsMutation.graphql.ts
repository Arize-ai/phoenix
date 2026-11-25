/**
 * @generated SignedSource<<0dd469e9fb32269271f28e6e01186cfc>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
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
export type ProviderModelsInput = {
  chat?: ModelsOfTypeInput | null;
  decision?: ModelsOfTypeInput | null;
};
export type ModelsOfTypeInput = {
  names?: ReadonlyArray<string>;
};
export type CustomProviderFormTestCredentialsMutation$variables = {
  input: GenerativeModelCustomerProviderConfigInput;
  models?: ProviderModelsInput | null;
};
export type CustomProviderFormTestCredentialsMutation$data = {
  readonly testGenerativeModelCustomProviderCredentials: {
    readonly chat: {
      readonly error: string | null;
    } | null;
    readonly decision: {
      readonly error: string | null;
    } | null;
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
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "models"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
},
v2 = [
  (v1/*:: as any*/)
],
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      },
      {
        "kind": "Variable",
        "name": "models",
        "variableName": "models"
      }
    ],
    "concreteType": "TestGenerativeModelCustomProviderCredentialsResult",
    "kind": "LinkedField",
    "name": "testGenerativeModelCustomProviderCredentials",
    "plural": false,
    "selections": [
      (v1/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "CustomProviderModelTypeCheck",
        "kind": "LinkedField",
        "name": "chat",
        "plural": false,
        "selections": (v2/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CustomProviderModelTypeCheck",
        "kind": "LinkedField",
        "name": "decision",
        "plural": false,
        "selections": (v2/*:: as any*/),
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
    "name": "CustomProviderFormTestCredentialsMutation",
    "selections": (v3/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "CustomProviderFormTestCredentialsMutation",
    "selections": (v3/*:: as any*/)
  },
  "params": {
    "cacheID": "90629d4ef9b8267a2e06a31c8b465ba2",
    "id": null,
    "metadata": {},
    "name": "CustomProviderFormTestCredentialsMutation",
    "operationKind": "mutation",
    "text": "mutation CustomProviderFormTestCredentialsMutation(\n  $input: GenerativeModelCustomerProviderConfigInput!\n  $models: ProviderModelsInput\n) {\n  testGenerativeModelCustomProviderCredentials(input: $input, models: $models) {\n    error\n    chat {\n      error\n    }\n    decision {\n      error\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "20711513d01ef41f5203c341ac9c0608";

export default node;
