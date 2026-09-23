/**
 * @generated SignedSource<<01aa11cbc2888037dffadabe55007345>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type InternetAccessChoice = "ALLOW" | "DENY";
export type Language = "PYTHON" | "TYPESCRIPT";
export type UpdateSandboxConfigInput = {
  config?: SandboxConfigVariantInput | null;
  description?: string | null;
  enabled?: boolean | null;
  id: string;
  timeout?: number | null;
};
export type SandboxConfigVariantInput = {
  daytona?: never;
  deno?: never;
  e2b: E2BConfigInput;
  modal?: never;
  monty?: never;
  vercel?: never;
  wasm?: never;
} | {
  daytona: DaytonaConfigInput;
  deno?: never;
  e2b?: never;
  modal?: never;
  monty?: never;
  vercel?: never;
  wasm?: never;
} | {
  daytona?: never;
  deno: DenoConfigInput;
  e2b?: never;
  modal?: never;
  monty?: never;
  vercel?: never;
  wasm?: never;
} | {
  daytona?: never;
  deno?: never;
  e2b?: never;
  modal?: never;
  monty?: never;
  vercel: VercelConfigInput;
  wasm?: never;
} | {
  daytona?: never;
  deno?: never;
  e2b?: never;
  modal?: never;
  monty?: never;
  vercel?: never;
  wasm: WASMConfigInput;
} | {
  daytona?: never;
  deno?: never;
  e2b?: never;
  modal: ModalConfigInput;
  monty?: never;
  vercel?: never;
  wasm?: never;
} | {
  daytona?: never;
  deno?: never;
  e2b?: never;
  modal?: never;
  monty: MontyConfigInput;
  vercel?: never;
  wasm?: never;
};
export type E2BConfigInput = {
  dependencies?: DependenciesInput | null;
  envVars?: ReadonlyArray<EnvVarInput>;
  internetAccess?: InternetAccessInput | null;
  language: Language;
};
export type EnvVarInput = {
  name: string;
  secretKey: string;
};
export type InternetAccessInput = {
  mode: InternetAccessChoice;
};
export type DependenciesInput = {
  packages?: ReadonlyArray<string>;
};
export type DaytonaConfigInput = {
  dependencies?: DependenciesInput | null;
  envVars?: ReadonlyArray<EnvVarInput>;
  internetAccess?: InternetAccessInput | null;
  language: Language;
};
export type DenoConfigInput = {
  language: Language;
};
export type VercelConfigInput = {
  dependencies?: DependenciesInput | null;
  envVars?: ReadonlyArray<EnvVarInput>;
  internetAccess?: InternetAccessInput | null;
  language: Language;
};
export type WASMConfigInput = {
  language?: Language;
};
export type ModalConfigInput = {
  dependencies?: DependenciesInput | null;
  envVars?: ReadonlyArray<EnvVarInput>;
  internetAccess?: InternetAccessInput | null;
  language?: Language;
};
export type MontyConfigInput = {
  language?: Language;
};
export type SandboxConfigDialogUpdateSandboxConfigMutation$variables = {
  input: UpdateSandboxConfigInput;
};
export type SandboxConfigDialogUpdateSandboxConfigMutation$data = {
  readonly updateSandboxConfig: {
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"SettingsSandboxesPageFragment">;
    };
  };
};
export type SandboxConfigDialogUpdateSandboxConfigMutation = {
  response: SandboxConfigDialogUpdateSandboxConfigMutation$data;
  variables: SandboxConfigDialogUpdateSandboxConfigMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "supportedLanguages",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SandboxConfigDialogUpdateSandboxConfigMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UpdateSandboxConfigPayload",
        "kind": "LinkedField",
        "name": "updateSandboxConfig",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SettingsSandboxesPageFragment"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SandboxConfigDialogUpdateSandboxConfigMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UpdateSandboxConfigPayload",
        "kind": "LinkedField",
        "name": "updateSandboxConfig",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "SandboxBackendInfo",
                "kind": "LinkedField",
                "name": "sandboxBackends",
                "plural": true,
                "selections": [
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
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
                    "name": "dependencyHints",
                    "storageKey": null
                  },
                  (v4/*:: as any*/),
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
                    "name": "statusDetail",
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
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "languageDialect",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "runtimeNotes",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SandboxProviderCredentialSpec",
                    "kind": "LinkedField",
                    "name": "credentialSpecs",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "key",
                        "storageKey": null
                      },
                      (v3/*:: as any*/),
                      (v5/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "isRequired",
                        "storageKey": null
                      }
                    ],
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
                  (v6/*:: as any*/),
                  (v2/*:: as any*/),
                  (v4/*:: as any*/),
                  (v7/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SandboxConfig",
                    "kind": "LinkedField",
                    "name": "configs",
                    "plural": true,
                    "selections": [
                      (v6/*:: as any*/),
                      (v8/*:: as any*/),
                      (v5/*:: as any*/),
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
                      (v7/*:: as any*/),
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
                              (v8/*:: as any*/),
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
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "506ecc29b72de6b788e037eaf0288e20",
    "id": null,
    "metadata": {},
    "name": "SandboxConfigDialogUpdateSandboxConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SandboxConfigDialogUpdateSandboxConfigMutation(\n  $input: UpdateSandboxConfigInput!\n) {\n  updateSandboxConfig(input: $input) {\n    query {\n      ...SettingsSandboxesPageFragment\n    }\n  }\n}\n\nfragment SettingsSandboxesPageFragment on Query {\n  sandboxBackends {\n    backendType\n    displayName\n    hostingType\n    dependencyHints\n    supportedLanguages\n    status\n    statusDetail\n    supportsEnvVars\n    internetAccess\n    supportsDependencies\n    languageDialect\n    runtimeNotes\n    credentialSpecs {\n      key\n      displayName\n      description\n      isRequired\n    }\n  }\n  sandboxProviders {\n    id\n    backendType\n    supportedLanguages\n    enabled\n    configs {\n      id\n      name\n      description\n      language\n      timeout\n      enabled\n      config {\n        envVars {\n          name\n          secretKey\n        }\n        internetAccess {\n          mode\n        }\n        dependencies {\n          packages\n        }\n      }\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e8cc94b67e9d2b990470eb5f0dd85d6d";

export default node;
