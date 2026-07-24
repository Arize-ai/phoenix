/**
 * @generated SignedSource<<b0086dd5f2e6ed5e1e8c9c2f7faba6de>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type InternetAccessChoice = "ALLOW" | "DENY";
export type InternetAccessMode = "BOOLEAN" | "NONE";
export type Language = "PYTHON" | "TYPESCRIPT";
export type SandboxBackendStatus = "AVAILABLE" | "DISABLED" | "MISSING_CREDENTIALS" | "NOT_INSTALLED" | "UNAVAILABLE";
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "TENKI" | "VERCEL" | "WASM";
export type CreateCodeDatasetEvaluatorSlideoverQuery$variables = Record<PropertyKey, never>;
export type CreateCodeDatasetEvaluatorSlideoverQuery$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly backendType: SandboxBackendType;
    readonly internetAccess: InternetAccessMode;
    readonly status: SandboxBackendStatus;
    readonly supportsDependencies: boolean;
    readonly supportsEnvVars: boolean;
  }>;
  readonly sandboxProviders: ReadonlyArray<{
    readonly backendType: SandboxBackendType;
    readonly configs: ReadonlyArray<{
      readonly config: {
        readonly dependencies: {
          readonly packages: ReadonlyArray<string>;
        } | null;
        readonly envVars: ReadonlyArray<{
          readonly name: string;
          readonly secretKey: string;
        }>;
        readonly internetAccess: {
          readonly mode: InternetAccessChoice;
        } | null;
      };
      readonly description: string | null;
      readonly id: string;
      readonly language: Language;
      readonly name: string;
      readonly timeout: number;
    }>;
    readonly enabled: boolean;
    readonly supportedLanguages: ReadonlyArray<Language>;
  }>;
};
export type CreateCodeDatasetEvaluatorSlideoverQuery = {
  response: CreateCodeDatasetEvaluatorSlideoverQuery$data;
  variables: CreateCodeDatasetEvaluatorSlideoverQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "supportedLanguages",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxConfig",
  "kind": "LinkedField",
  "name": "configs",
  "plural": true,
  "selections": [
    (v3/*:: as any*/),
    (v4/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "description",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "language",
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
      "concreteType": "SandboxConfigData",
      "kind": "LinkedField",
      "name": "config",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfigEnvVar",
          "kind": "LinkedField",
          "name": "envVars",
          "plural": true,
          "selections": [
            (v4/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "secretKey",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfigInternetAccess",
          "kind": "LinkedField",
          "name": "internetAccess",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "mode",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfigDependencies",
          "kind": "LinkedField",
          "name": "dependencies",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "packages",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v6 = {
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
      "name": "status",
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
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateCodeDatasetEvaluatorSlideoverQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxProvider",
        "kind": "LinkedField",
        "name": "sandboxProviders",
        "plural": true,
        "selections": [
          (v0/*:: as any*/),
          (v1/*:: as any*/),
          (v2/*:: as any*/),
          (v5/*:: as any*/)
        ],
        "storageKey": null
      },
      (v6/*:: as any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "CreateCodeDatasetEvaluatorSlideoverQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxProvider",
        "kind": "LinkedField",
        "name": "sandboxProviders",
        "plural": true,
        "selections": [
          (v0/*:: as any*/),
          (v1/*:: as any*/),
          (v2/*:: as any*/),
          (v5/*:: as any*/),
          (v3/*:: as any*/)
        ],
        "storageKey": null
      },
      (v6/*:: as any*/)
    ]
  },
  "params": {
    "cacheID": "d0f7ce5ba2741c5b3a625311f5f02c1f",
    "id": null,
    "metadata": {},
    "name": "CreateCodeDatasetEvaluatorSlideoverQuery",
    "operationKind": "query",
    "text": "query CreateCodeDatasetEvaluatorSlideoverQuery {\n  sandboxProviders {\n    backendType\n    supportedLanguages\n    enabled\n    configs {\n      id\n      name\n      description\n      language\n      timeout\n      config {\n        envVars {\n          name\n          secretKey\n        }\n        internetAccess {\n          mode\n        }\n        dependencies {\n          packages\n        }\n      }\n    }\n    id\n  }\n  sandboxBackends {\n    backendType\n    status\n    supportsEnvVars\n    internetAccess\n    supportsDependencies\n  }\n}\n"
  }
};
})();

(node as any).hash = "c69bb10ac38c3e255f0b6745bcc89fd5";

export default node;
