/**
 * @generated SignedSource<<c761e26049f7bf76e60c5c30d89d8974>>
 * @lightSyntaxTransform
 * @nogrep
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
  "name": "description",
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
  "name": "enabled",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "config",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
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
          (v0/*: any*/),
          (v1/*: any*/),
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
            "name": "dependenciesLanguage",
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
              (v1/*: any*/),
              (v2/*: any*/),
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
          (v3/*: any*/),
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "language",
            "storageKey": null
          },
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "SandboxConfig",
            "kind": "LinkedField",
            "name": "configs",
            "plural": true,
            "selections": [
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              },
              (v2/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "timeout",
                "storageKey": null
              },
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5f6072e0eac5e1c867306c26ed490d33",
    "id": null,
    "metadata": {},
    "name": "settingsSandboxesPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsSandboxesPageLoaderQuery {\n  ...SettingsSandboxesPageFragment\n}\n\nfragment SettingsSandboxesPageFragment on Query {\n  sandboxBackends {\n    backendType\n    displayName\n    hostingType\n    dependencyHints\n    supportedLanguages\n    status\n    statusDetail\n    supportsEnvVars\n    internetAccess\n    dependenciesLanguage\n    credentialSpecs {\n      key\n      displayName\n      description\n      isRequired\n    }\n  }\n  sandboxProviders {\n    id\n    backendType\n    language\n    enabled\n    config\n    updatedAt\n    configs {\n      id\n      name\n      description\n      timeout\n      enabled\n      config\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8b7c1366afbed5a07d5e628b48bd100c";

export default node;
