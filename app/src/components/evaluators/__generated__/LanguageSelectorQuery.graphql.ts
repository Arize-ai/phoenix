/**
 * @generated SignedSource<<fd0816f5a1e1f94b70594f26c61df93a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendStatusCode = "AVAILABLE" | "NEEDS_CONFIG" | "NEEDS_CREDENTIALS" | "NOT_INSTALLED";
export type SandboxLanguage = "PYTHON" | "TYPESCRIPT";
export type LanguageSelectorQuery$variables = Record<PropertyKey, never>;
export type LanguageSelectorQuery$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly key: string;
    readonly status: SandboxBackendStatusCode;
    readonly supportedLanguages: ReadonlyArray<SandboxLanguage>;
  }>;
};
export type LanguageSelectorQuery = {
  response: LanguageSelectorQuery$data;
  variables: LanguageSelectorQuery$variables;
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
    "name": "LanguageSelectorQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "LanguageSelectorQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "7fd2c17ee8fedb7104596e4ae0a5ce60",
    "id": null,
    "metadata": {},
    "name": "LanguageSelectorQuery",
    "operationKind": "query",
    "text": "query LanguageSelectorQuery {\n  sandboxBackends {\n    key\n    status\n    supportedLanguages\n  }\n}\n"
  }
};
})();

(node as any).hash = "2c9b16e0dfa0bf995d48f2744d290720";

export default node;
