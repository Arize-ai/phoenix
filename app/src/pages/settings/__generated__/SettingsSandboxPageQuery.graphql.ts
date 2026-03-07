/**
 * @generated SignedSource<<48e215b062d95afee99cf2320db26e01>>
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
    readonly currentConfig: {
      readonly backendType: SandboxBackendType;
      readonly config: any;
      readonly configHash: string;
      readonly id: string;
      readonly sessionMode: boolean;
      readonly timeout: number;
    } | null;
    readonly description: string;
    readonly envVars: ReadonlyArray<{
      readonly description: string;
      readonly name: string;
      readonly required: boolean;
    }>;
    readonly hasSessionMode: boolean;
    readonly key: string;
    readonly label: string;
    readonly setupInstructions: ReadonlyArray<string>;
    readonly status: SandboxBackendStatusCode;
  }>;
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
v3 = [
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
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxEnvVarSpec",
        "kind": "LinkedField",
        "name": "envVars",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          },
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
        "name": "hasSessionMode",
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
        "concreteType": "SandboxConfig",
        "kind": "LinkedField",
        "name": "currentConfig",
        "plural": false,
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "sessionMode",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "configHash",
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
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SettingsSandboxPageQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "ad2175ed1264dd2312d738d88ce9349a",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageQuery",
    "operationKind": "query",
    "text": "query SettingsSandboxPageQuery {\n  sandboxBackends {\n    key\n    label\n    description\n    status\n    envVars {\n      name\n      required\n      description\n    }\n    configFields {\n      key\n      label\n      placeholder\n      description\n    }\n    configRequired\n    hasSessionMode\n    setupInstructions\n    currentConfig {\n      id\n      backendType\n      config\n      timeout\n      sessionMode\n      configHash\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "10e3f6d5512fa0f07c6f62d369d91231";

export default node;
