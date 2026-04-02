/**
 * @generated SignedSource<<d2bb746f7e0ba261110590774c98627a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UpdateSandboxConfigInput = {
  config?: any | null;
  description?: string | null;
  enabled?: boolean | null;
  id: string;
  timeout?: number | null;
};
export type SandboxConfigsCardConfigEnabledSwitchMutation$variables = {
  input: UpdateSandboxConfigInput;
};
export type SandboxConfigsCardConfigEnabledSwitchMutation$data = {
  readonly updateSandboxConfig: {
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"SettingsSandboxesPageFragment">;
    };
  };
};
export type SandboxConfigsCardConfigEnabledSwitchMutation = {
  response: SandboxConfigsCardConfigEnabledSwitchMutation$data;
  variables: SandboxConfigsCardConfigEnabledSwitchMutation$variables;
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SandboxConfigsCardConfigEnabledSwitchMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SandboxConfigsCardConfigEnabledSwitchMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                  (v2/*: any*/),
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
                  (v3/*: any*/),
                  (v2/*: any*/),
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
                      (v4/*: any*/),
                      (v5/*: any*/),
                      (v6/*: any*/)
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
    "cacheID": "d96bdb62685f8db90116eac59f27558f",
    "id": null,
    "metadata": {},
    "name": "SandboxConfigsCardConfigEnabledSwitchMutation",
    "operationKind": "mutation",
    "text": "mutation SandboxConfigsCardConfigEnabledSwitchMutation(\n  $input: UpdateSandboxConfigInput!\n) {\n  updateSandboxConfig(input: $input) {\n    query {\n      ...SettingsSandboxesPageFragment\n    }\n  }\n}\n\nfragment SettingsSandboxesPageFragment on Query {\n  sandboxBackends {\n    backendType\n    displayName\n    dependencyHints\n    supportedLanguages\n    status\n  }\n  sandboxProviders {\n    id\n    backendType\n    language\n    enabled\n    config\n    updatedAt\n    configs {\n      id\n      name\n      description\n      timeout\n      enabled\n      config\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b0aeb96886207d6229f0a2dc3f35cacb";

export default node;
