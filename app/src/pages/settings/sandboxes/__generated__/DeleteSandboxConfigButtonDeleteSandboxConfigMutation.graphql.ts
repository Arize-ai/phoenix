/**
 * @generated SignedSource<<80f0da3667d77485b15b634946f12ffc>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeleteSandboxConfigInput = {
  id: string;
};
export type DeleteSandboxConfigButtonDeleteSandboxConfigMutation$variables = {
  input: DeleteSandboxConfigInput;
};
export type DeleteSandboxConfigButtonDeleteSandboxConfigMutation$data = {
  readonly deleteSandboxConfig: {
    readonly deletedId: string;
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"SettingsSandboxesPageFragment">;
    };
  };
};
export type DeleteSandboxConfigButtonDeleteSandboxConfigMutation = {
  response: DeleteSandboxConfigButtonDeleteSandboxConfigMutation$data;
  variables: DeleteSandboxConfigButtonDeleteSandboxConfigMutation$variables;
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
  "name": "deletedId",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "supportedLanguages",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v9 = {
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
    "name": "DeleteSandboxConfigButtonDeleteSandboxConfigMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DeleteSandboxConfigPayload",
        "kind": "LinkedField",
        "name": "deleteSandboxConfig",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
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
    "name": "DeleteSandboxConfigButtonDeleteSandboxConfigMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DeleteSandboxConfigPayload",
        "kind": "LinkedField",
        "name": "deleteSandboxConfig",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
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
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
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
                  (v5/*:: as any*/),
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
                      (v4/*:: as any*/),
                      (v6/*:: as any*/),
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
                  (v7/*:: as any*/),
                  (v3/*:: as any*/),
                  (v5/*:: as any*/),
                  (v8/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SandboxConfig",
                    "kind": "LinkedField",
                    "name": "configs",
                    "plural": true,
                    "selections": [
                      (v7/*:: as any*/),
                      (v9/*:: as any*/),
                      (v6/*:: as any*/),
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
                      (v8/*:: as any*/),
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
                              (v9/*:: as any*/),
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
    "cacheID": "807801e95fa9a85d0094cc51ad47cbc3",
    "id": null,
    "metadata": {},
    "name": "DeleteSandboxConfigButtonDeleteSandboxConfigMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteSandboxConfigButtonDeleteSandboxConfigMutation(\n  $input: DeleteSandboxConfigInput!\n) {\n  deleteSandboxConfig(input: $input) {\n    deletedId\n    query {\n      ...SettingsSandboxesPageFragment\n    }\n  }\n}\n\nfragment SettingsSandboxesPageFragment on Query {\n  sandboxBackends {\n    backendType\n    displayName\n    hostingType\n    dependencyHints\n    supportedLanguages\n    status\n    statusDetail\n    supportsEnvVars\n    internetAccess\n    supportsDependencies\n    credentialSpecs {\n      key\n      displayName\n      description\n      isRequired\n    }\n  }\n  sandboxProviders {\n    id\n    backendType\n    supportedLanguages\n    enabled\n    configs {\n      id\n      name\n      description\n      language\n      timeout\n      enabled\n      config {\n        envVars {\n          name\n          secretKey\n        }\n        internetAccess {\n          mode\n        }\n        dependencies {\n          packages\n        }\n      }\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "814f1d281ae079e2a14d869109431b60";

export default node;
