/**
 * @generated SignedSource<<cd9f4a0e38cbe86fea0d0c4b4e872264>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "XAI";
export type PlaygroundCredentialsDropdownQuery$variables = Record<PropertyKey, never>;
export type PlaygroundCredentialsDropdownQuery$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly credentialRequirements: ReadonlyArray<{
      readonly envVarName: string;
      readonly isRequired: boolean;
    }>;
    readonly credentialsSet: boolean;
    readonly key: GenerativeProviderKey;
  }>;
};
export type PlaygroundCredentialsDropdownQuery = {
  response: PlaygroundCredentialsDropdownQuery$data;
  variables: PlaygroundCredentialsDropdownQuery$variables;
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
    "name": "PlaygroundCredentialsDropdownQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PlaygroundCredentialsDropdownQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "b2f9b2067f4b46cd6a570aca5156ba48",
    "id": null,
    "metadata": {},
    "name": "PlaygroundCredentialsDropdownQuery",
    "operationKind": "query",
    "text": "query PlaygroundCredentialsDropdownQuery {\n  modelProviders {\n    key\n    credentialRequirements {\n      envVarName\n      isRequired\n    }\n    credentialsSet\n  }\n}\n"
  }
};
})();

(node as any).hash = "06227c780cfcd0a1d7771fb53fddc803";

export default node;
