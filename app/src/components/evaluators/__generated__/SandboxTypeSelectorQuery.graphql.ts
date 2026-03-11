/**
 * @generated SignedSource<<fc974294ad7d79d6fd802597a055fda3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendStatusCode = "AVAILABLE" | "NEEDS_CONFIG" | "NEEDS_CREDENTIALS" | "NOT_INSTALLED";
export type SandboxLanguage = "PYTHON" | "TYPESCRIPT";
export type SandboxTypeSelectorQuery$variables = Record<PropertyKey, never>;
export type SandboxTypeSelectorQuery$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly status: SandboxBackendStatusCode;
    readonly supportedLanguages: ReadonlyArray<SandboxLanguage>;
  }>;
};
export type SandboxTypeSelectorQuery = {
  response: SandboxTypeSelectorQuery$data;
  variables: SandboxTypeSelectorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "SandboxAdapterInfo",
    "kind": "LinkedField",
    "name": "sandboxBackends",
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
        "name": "label",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "status",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "supportedLanguages",
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
    "name": "SandboxTypeSelectorQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SandboxTypeSelectorQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "b4661516b831fc57b4cb583da7cdbeb9",
    "id": null,
    "metadata": {},
    "name": "SandboxTypeSelectorQuery",
    "operationKind": "query",
    "text": "query SandboxTypeSelectorQuery {\n  sandboxBackends {\n    key\n    label\n    status\n    supportedLanguages\n  }\n}\n"
  }
};
})();

(node as any).hash = "b92b324a6f0bc5a6fe0cbec8a8279d17";

export default node;
