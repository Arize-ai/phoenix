/**
 * @generated SignedSource<<1a888bd8e4075e479df96ddcb089b3f5>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type InternetAccessMode = "BOOLEAN" | "NONE";
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "MONTY" | "VERCEL" | "WASM";
export type CodeEvaluatorSandboxCardBackendsQuery$variables = Record<PropertyKey, never>;
export type CodeEvaluatorSandboxCardBackendsQuery$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly backendType: SandboxBackendType;
    readonly displayName: string;
    readonly internetAccess: InternetAccessMode;
    readonly supportsDependencies: boolean;
    readonly supportsEnvVars: boolean;
  }>;
};
export type CodeEvaluatorSandboxCardBackendsQuery = {
  response: CodeEvaluatorSandboxCardBackendsQuery$data;
  variables: CodeEvaluatorSandboxCardBackendsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "SandboxBackendInfo",
    "kind": "LinkedField",
    "name": "sandboxBackends",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "backendType",
        "storageKey": null
      },
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
        "name": "supportsEnvVars",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "internetAccess",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "supportsDependencies",
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
    "name": "CodeEvaluatorSandboxCardBackendsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "CodeEvaluatorSandboxCardBackendsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "2119f404ea3f15511b2f8f2b5788a788",
    "id": null,
    "metadata": {},
    "name": "CodeEvaluatorSandboxCardBackendsQuery",
    "operationKind": "query",
    "text": "query CodeEvaluatorSandboxCardBackendsQuery {\n  sandboxBackends {\n    backendType\n    displayName\n    supportsEnvVars\n    internetAccess\n    supportsDependencies\n  }\n}\n"
  }
};
})();

(node as any).hash = "21722d7f1aa0c8ab4bbcbcc323e7170d";

export default node;
