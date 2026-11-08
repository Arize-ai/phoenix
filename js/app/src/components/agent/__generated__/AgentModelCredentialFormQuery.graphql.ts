/**
 * @generated SignedSource<<e87ca01462118ccfe1d233873e046a34>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI" | "ZAI";
export type AgentModelCredentialFormQuery$variables = Record<PropertyKey, never>;
export type AgentModelCredentialFormQuery$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly credentialRequirements: ReadonlyArray<{
      readonly envVarName: string;
      readonly isRequired: boolean;
      readonly isSetInServerEnvironment: boolean;
    }>;
    readonly credentialsSet: boolean;
    readonly key: GenerativeProviderKey;
    readonly name: string;
  }>;
};
export type AgentModelCredentialFormQuery = {
  response: AgentModelCredentialFormQuery$data;
  variables: AgentModelCredentialFormQuery$variables;
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isSetInServerEnvironment",
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
    "name": "AgentModelCredentialFormQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "AgentModelCredentialFormQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "e6d67b46d4509cbd5a4ab38bdf378145",
    "id": null,
    "metadata": {},
    "name": "AgentModelCredentialFormQuery",
    "operationKind": "query",
    "text": "query AgentModelCredentialFormQuery {\n  modelProviders {\n    key\n    name\n    credentialRequirements {\n      envVarName\n      isRequired\n      isSetInServerEnvironment\n    }\n    credentialsSet\n  }\n}\n"
  }
};
})();

(node as any).hash = "3ebe81a4db64215ecb9fd800423c6cea";

export default node;
