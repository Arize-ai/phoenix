/**
 * @generated SignedSource<<97cf03fd5813fc3541faaacb271b4760>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "BEDROCK" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type ModelComboBoxQuery$variables = {
  providerKey: GenerativeProviderKey;
};
export type ModelComboBoxQuery$data = {
  readonly models: ReadonlyArray<{
    readonly name: string;
  }>;
};
export type ModelComboBoxQuery = {
  response: ModelComboBoxQuery$data;
  variables: ModelComboBoxQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "providerKey"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "providerKey",
            "variableName": "providerKey"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "GenerativeModel",
    "kind": "LinkedField",
    "name": "models",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
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
    "name": "ModelComboBoxQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ModelComboBoxQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a3417a3b2ae9ad193a5fd68335cfd660",
    "id": null,
    "metadata": {},
    "name": "ModelComboBoxQuery",
    "operationKind": "query",
    "text": "query ModelComboBoxQuery(\n  $providerKey: GenerativeProviderKey!\n) {\n  models(input: {providerKey: $providerKey}) {\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "fc5563c6dca10fdeda807cd7061e275a";

export default node;
