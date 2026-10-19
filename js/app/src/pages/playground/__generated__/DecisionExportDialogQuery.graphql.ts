/**
 * @generated SignedSource<<9df556012e389eca30797c50ae910fc6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionWireFormat = "OPENAI_DECISIONS" | "SYSTEM_ONE";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type DecisionExportDialogQuery$variables = Record<PropertyKey, never>;
export type DecisionExportDialogQuery$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly decisionWireFormat: DecisionWireFormat | null;
    readonly key: GenerativeProviderKey;
  }>;
};
export type DecisionExportDialogQuery = {
  response: DecisionExportDialogQuery$data;
  variables: DecisionExportDialogQuery$variables;
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
        "name": "decisionWireFormat",
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
    "name": "DecisionExportDialogQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DecisionExportDialogQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "45a107200c2da787d42f1ad74e0b06f9",
    "id": null,
    "metadata": {},
    "name": "DecisionExportDialogQuery",
    "operationKind": "query",
    "text": "query DecisionExportDialogQuery {\n  modelProviders {\n    key\n    decisionWireFormat\n  }\n}\n"
  }
};
})();

(node as any).hash = "d0d7ec3df3baf4a55775b8053c14b163";

export default node;
