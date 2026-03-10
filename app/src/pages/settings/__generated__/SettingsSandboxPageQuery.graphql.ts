/**
 * @generated SignedSource<<048919b5bb6b177eaa2228130c450799>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendStatusCode = "AVAILABLE" | "NEEDS_CONFIG" | "NEEDS_CREDENTIALS" | "NOT_INSTALLED";
export type SandboxBackendType = "DAYTONA" | "E2B" | "VERCEL" | "WASM";
export type SettingsSandboxPageQuery$variables = Record<PropertyKey, never>;
export type SettingsSandboxPageQuery$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly configFields: ReadonlyArray<{
      readonly description: string;
      readonly key: string;
      readonly label: string;
      readonly placeholder: string;
    }>;
    readonly configRequired: boolean;
    readonly configs: ReadonlyArray<{
      readonly backendType: SandboxBackendType;
      readonly config: any;
      readonly configHash: string;
      readonly createdAt: string;
      readonly description: string | null;
      readonly enabled: boolean;
      readonly id: string;
      readonly name: string;
      readonly timeout: number;
      readonly updatedAt: string;
    }>;
    readonly description: string;
    readonly enabled: boolean;
    readonly envVars: ReadonlyArray<{
      readonly description: string;
      readonly name: string;
      readonly required: boolean;
    }>;
    readonly key: string;
    readonly label: string;
    readonly setupInstructions: ReadonlyArray<string>;
    readonly status: SandboxBackendStatusCode;
  }>;
  readonly sandboxEnabled: boolean;
};
export type SettingsSandboxPageQuery = {
  response: SettingsSandboxPageQuery$data;
  variables: SettingsSandboxPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "key",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "sandboxEnabled",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "SandboxAdapterInfo",
    "kind": "LinkedField",
    "name": "sandboxBackends",
    "plural": true,
    "selections": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "status",
        "storageKey": null
      },
      (v3/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxEnvVarSpec",
        "kind": "LinkedField",
        "name": "envVars",
        "plural": true,
        "selections": [
          (v4/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "required",
            "storageKey": null
          },
          (v2/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxConfigFieldSpec",
        "kind": "LinkedField",
        "name": "configFields",
        "plural": true,
        "selections": [
          (v0/*: any*/),
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "placeholder",
            "storageKey": null
          },
          (v2/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "configRequired",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "setupInstructions",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxConfigInstance",
        "kind": "LinkedField",
        "name": "configs",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "backendType",
            "storageKey": null
          },
          (v4/*: any*/),
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "config",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "timeout",
            "storageKey": null
          },
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "configHash",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "createdAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "updatedAt",
            "storageKey": null
          }
        ],
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
    "name": "SettingsSandboxPageQuery",
    "selections": (v5/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SettingsSandboxPageQuery",
    "selections": (v5/*: any*/)
  },
  "params": {
    "cacheID": "760049ed44227f24191a04da0a583691",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageQuery",
    "operationKind": "query",
    "text": "query SettingsSandboxPageQuery {\n  sandboxEnabled\n  sandboxBackends {\n    key\n    label\n    description\n    status\n    enabled\n    envVars {\n      name\n      required\n      description\n    }\n    configFields {\n      key\n      label\n      placeholder\n      description\n    }\n    configRequired\n    setupInstructions\n    configs {\n      id\n      backendType\n      name\n      description\n      config\n      timeout\n      enabled\n      configHash\n      createdAt\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b851ca0cf3c803dbc95ed999d7309b0e";

export default node;
