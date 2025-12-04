/**
 * @generated SignedSource<<7e69d3e068af11b43d888e3166b45f56>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type PlaygroundCredentialsDropdownEnvQuery$variables = Record<PropertyKey, never>;
export type PlaygroundCredentialsDropdownEnvQuery$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly credentialRequirements: ReadonlyArray<{
      readonly envVarName: string;
      readonly isRequired: boolean;
    }>;
    readonly credentialsSet: boolean;
    readonly key: GenerativeProviderKey;
  }>;
};
export type PlaygroundCredentialsDropdownEnvQuery = {
  response: PlaygroundCredentialsDropdownEnvQuery$data;
  variables: PlaygroundCredentialsDropdownEnvQuery$variables;
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
    "name": "PlaygroundCredentialsDropdownEnvQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PlaygroundCredentialsDropdownEnvQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "9405d6a8401dd1ce6ea97fb6bec366aa",
    "id": null,
    "metadata": {},
    "name": "PlaygroundCredentialsDropdownEnvQuery",
    "operationKind": "query",
    "text": "query PlaygroundCredentialsDropdownEnvQuery {\n  modelProviders {\n    key\n    credentialRequirements {\n      envVarName\n      isRequired\n    }\n    credentialsSet\n  }\n}\n"
  }
};
})();

(node as any).hash = "31cc5dd6ac3e3008c5439f7c756bdbf8";

export default node;
