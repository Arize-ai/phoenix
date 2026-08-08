/**
 * @generated SignedSource<<ff61233fa8c0d40c2cbf1fe498d38e19>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type AgentModelCredentialFormQuery$variables = Record<PropertyKey, never>;
export type AgentModelCredentialFormQuery$data = {
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
    "cacheID": "a6916c8120d35f25c7f0b7f43da14a0e",
    "id": null,
    "metadata": {},
    "name": "AgentModelCredentialFormQuery",
    "operationKind": "query",
    "text": "query AgentModelCredentialFormQuery {\n  modelProviders {\n    key\n    name\n    credentialRequirements {\n      envVarName\n      isRequired\n    }\n    credentialsSet\n  }\n}\n"
  }
};
})();

(node as any).hash = "a81978bba5774466471be375e4f1ff68";

export default node;
