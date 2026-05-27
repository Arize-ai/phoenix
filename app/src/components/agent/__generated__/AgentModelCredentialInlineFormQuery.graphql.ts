/**
 * @generated SignedSource<<0b2d56ba70671238f5d94ef3b3cc58de>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type AgentModelCredentialInlineFormQuery$variables = Record<PropertyKey, never>;
export type AgentModelCredentialInlineFormQuery$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly credentialRequirements: ReadonlyArray<{
      readonly envVarName: string;
      readonly isRequired: boolean;
    }>;
    readonly credentialsSet: boolean;
    readonly key: GenerativeProviderKey;
    readonly name: string;
  }>;
};
export type AgentModelCredentialInlineFormQuery = {
  response: AgentModelCredentialInlineFormQuery$data;
  variables: AgentModelCredentialInlineFormQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "GenerativeProvider",
    "kind": "LinkedField",
    "name": "modelProviders",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "key",
        "storageKey": null
      },
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
        "concreteType": "GenerativeProviderCredentialConfig",
        "kind": "LinkedField",
        "name": "credentialRequirements",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "envVarName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isRequired",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "credentialsSet",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "AgentModelCredentialInlineFormQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "AgentModelCredentialInlineFormQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "424d98cc11df4c6c03320d4a76a60d8a",
    "id": null,
    "metadata": {},
    "name": "AgentModelCredentialInlineFormQuery",
    "operationKind": "query",
    "text": "query AgentModelCredentialInlineFormQuery {\n  modelProviders {\n    key\n    name\n    credentialRequirements {\n      envVarName\n      isRequired\n    }\n    credentialsSet\n  }\n}\n"
  }
};
})();

(node as any).hash = "8d4648f36227c4b590cd4a9535ce1fde";

export default node;
