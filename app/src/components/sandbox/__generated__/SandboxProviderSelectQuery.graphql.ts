/**
 * @generated SignedSource<<060a3d494c8abbb272371f92949988e6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
export type SandboxBackendStatus = "AVAILABLE" | "DISABLED" | "MISSING_CREDENTIALS" | "NOT_INSTALLED" | "UNAVAILABLE";
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "MONTY" | "VERCEL" | "WASM";
export type SandboxHostingType = "HOSTED" | "LOCAL";
export type SandboxProviderSelectQuery$variables = Record<PropertyKey, never>;
export type SandboxProviderSelectQuery$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly backendType: SandboxBackendType;
    readonly displayName: string;
    readonly hostingType: SandboxHostingType;
    readonly status: SandboxBackendStatus;
  }>;
  readonly sandboxProviders: ReadonlyArray<{
    readonly backendType: SandboxBackendType;
    readonly enabled: boolean;
    readonly id: string;
    readonly supportedLanguages: ReadonlyArray<Language>;
  }>;
};
export type SandboxProviderSelectQuery = {
  response: SandboxProviderSelectQuery$data;
  variables: SandboxProviderSelectQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v1 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "SandboxBackendInfo",
    "kind": "LinkedField",
    "name": "sandboxBackends",
    "plural": true,
    "selections": [
      (v0/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "displayName",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "hostingType",
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
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "SandboxProvider",
    "kind": "LinkedField",
    "name": "sandboxProviders",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      (v0/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "supportedLanguages",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "enabled",
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
    "name": "SandboxProviderSelectQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SandboxProviderSelectQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "42d29259e4b238dcb302735225ba153d",
    "id": null,
    "metadata": {},
    "name": "SandboxProviderSelectQuery",
    "operationKind": "query",
    "text": "query SandboxProviderSelectQuery {\n  sandboxBackends {\n    backendType\n    displayName\n    hostingType\n    status\n  }\n  sandboxProviders {\n    id\n    backendType\n    supportedLanguages\n    enabled\n  }\n}\n"
  }
};
})();

(node as any).hash = "40b8f43cd90c889754ca91a395c37dc0";

export default node;
