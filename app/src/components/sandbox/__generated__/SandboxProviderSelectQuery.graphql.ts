/**
 * @generated SignedSource<<16ee6d2e761c6632c3d7446d03234d35>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
export type SandboxBackendStatus = "AVAILABLE" | "MISSING_CREDENTIALS" | "NOT_INSTALLED" | "UNAVAILABLE";
export type SandboxHostingType = "HOSTED" | "LOCAL";
export type SandboxProviderKind = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "VERCEL" | "WASM";
export type SandboxProviderSelectQuery$variables = Record<PropertyKey, never>;
export type SandboxProviderSelectQuery$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly displayName: string;
    readonly hostingType: SandboxHostingType;
    readonly kind: SandboxProviderKind;
    readonly status: SandboxBackendStatus;
  }>;
  readonly sandboxProviders: ReadonlyArray<{
    readonly enabled: boolean;
    readonly id: string;
    readonly kind: SandboxProviderKind;
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
  "name": "kind",
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
      (v0/*: any*/),
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
      (v0/*: any*/),
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
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SandboxProviderSelectQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "09b64b28dae3d590768ad64e6d9d17b2",
    "id": null,
    "metadata": {},
    "name": "SandboxProviderSelectQuery",
    "operationKind": "query",
    "text": "query SandboxProviderSelectQuery {\n  sandboxBackends {\n    kind\n    displayName\n    hostingType\n    status\n  }\n  sandboxProviders {\n    id\n    kind\n    supportedLanguages\n    enabled\n  }\n}\n"
  }
};
})();

(node as any).hash = "c23a47b43528ff01fca59bf10bf36d5a";

export default node;
