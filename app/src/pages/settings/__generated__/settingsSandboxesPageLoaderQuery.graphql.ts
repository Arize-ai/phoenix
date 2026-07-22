/**
 * @generated SignedSource<<1f1b2194597fedb00f9feb9865af728f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsSandboxesPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsSandboxesPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"SettingsSandboxesPageFragment">;
};
export type settingsSandboxesPageLoaderQuery = {
  response: settingsSandboxesPageLoaderQuery$data;
  variables: settingsSandboxesPageLoaderQuery$variables;
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
  "name": "displayName",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "supportedLanguages",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "settingsSandboxesPageLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "SettingsSandboxesPageFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "settingsSandboxesPageLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxBackendInfo",
        "kind": "LinkedField",
        "name": "sandboxBackends",
        "plural": true,
        "selections": [
          (v0/*:: as any*/),
          (v1/*:: as any*/),
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
          (v2/*:: as any*/),
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
              (v1/*:: as any*/),
              (v3/*:: as any*/),
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
          (v4/*:: as any*/),
          (v0/*:: as any*/),
          (v2/*:: as any*/),
          (v5/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "SandboxConfig",
            "kind": "LinkedField",
            "name": "configs",
            "plural": true,
            "selections": [
              (v4/*:: as any*/),
              (v6/*:: as any*/),
              (v3/*:: as any*/),
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
              (v5/*:: as any*/),
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
                      (v6/*:: as any*/),
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
    ]
  },
  "params": {
    "cacheID": "8eb543e104b4f269503cfcc6696886ed",
    "id": null,
    "metadata": {},
    "name": "settingsSandboxesPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsSandboxesPageLoaderQuery {\n  ...SettingsSandboxesPageFragment\n}\n\nfragment SettingsSandboxesPageFragment on Query {\n  sandboxBackends {\n    backendType\n    displayName\n    hostingType\n    dependencyHints\n    supportedLanguages\n    status\n    statusDetail\n    supportsEnvVars\n    internetAccess\n    supportsDependencies\n    credentialSpecs {\n      key\n      displayName\n      description\n      isRequired\n    }\n  }\n  sandboxProviders {\n    id\n    backendType\n    supportedLanguages\n    enabled\n    configs {\n      id\n      name\n      description\n      language\n      timeout\n      enabled\n      config {\n        envVars {\n          name\n          secretKey\n        }\n        internetAccess {\n          mode\n        }\n        dependencies {\n          packages\n        }\n      }\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8b7c1366afbed5a07d5e628b48bd100c";

export default node;
