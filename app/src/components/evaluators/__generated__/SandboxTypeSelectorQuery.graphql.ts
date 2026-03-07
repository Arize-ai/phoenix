/**
 * @generated SignedSource<<7134a5bc05be0bf93b485d6b34fc9ddd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendStatusCode = "AVAILABLE" | "NEEDS_CONFIG" | "NEEDS_CREDENTIALS" | "NOT_INSTALLED";
export type SandboxTypeSelectorQuery$variables = Record<PropertyKey, never>;
export type SandboxTypeSelectorQuery$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly status: SandboxBackendStatusCode;
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
    "cacheID": "60062a41dcb001e07a3818d601f8b3d9",
    "id": null,
    "metadata": {},
    "name": "SandboxTypeSelectorQuery",
    "operationKind": "query",
    "text": "query SandboxTypeSelectorQuery {\n  sandboxBackends {\n    key\n    label\n    status\n  }\n}\n"
  }
};
})();

(node as any).hash = "14c359f1a9638244362c7179df0274c8";

export default node;
