/**
 * @generated SignedSource<<4d036bf923313741ca49cf65ad5e8e4a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeleteSandboxConfigButtonDeleteSandboxConfigMutation$variables = {
  id: string;
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
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
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
  "name": "config",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DeleteSandboxConfigButtonDeleteSandboxConfigMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteSandboxConfigPayload",
        "kind": "LinkedField",
        "name": "deleteSandboxConfig",
        "plural": false,
        "selections": [
          (v2/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DeleteSandboxConfigButtonDeleteSandboxConfigMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteSandboxConfigPayload",
        "kind": "LinkedField",
        "name": "deleteSandboxConfig",
        "plural": false,
        "selections": [
          (v2/*: any*/),
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
                  (v3/*: any*/),
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
                  (v4/*: any*/),
                  (v3/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "language",
                    "storageKey": null
                  },
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SandboxConfig",
                    "kind": "LinkedField",
                    "name": "configs",
                    "plural": true,
                    "selections": [
                      (v4/*: any*/),
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
                        "name": "description",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "timeout",
                        "storageKey": null
                      },
                      (v5/*: any*/),
                      (v6/*: any*/),
                      (v7/*: any*/)
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
    "cacheID": "a9c656cb160fb804929a70754fd5e189",
    "id": null,
    "metadata": {},
    "name": "DeleteSandboxConfigButtonDeleteSandboxConfigMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteSandboxConfigButtonDeleteSandboxConfigMutation(\n  $id: ID!\n) {\n  deleteSandboxConfig(id: $id) {\n    deletedId\n    query {\n      ...SettingsSandboxesPageFragment\n    }\n  }\n}\n\nfragment SettingsSandboxesPageFragment on Query {\n  sandboxBackends {\n    backendType\n    displayName\n    dependencyHints\n    supportedLanguages\n    status\n  }\n  sandboxProviders {\n    id\n    backendType\n    language\n    enabled\n    config\n    updatedAt\n    configs {\n      id\n      name\n      description\n      timeout\n      enabled\n      config\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "31b1ce9a2f9da67df083832d678f5d0a";

export default node;
