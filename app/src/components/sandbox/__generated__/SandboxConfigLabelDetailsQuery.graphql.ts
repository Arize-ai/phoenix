/**
 * @generated SignedSource<<3567009cea0fb5adfa600c85f36750e3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type InternetAccessChoice = "ALLOW" | "DENY";
export type SandboxConfigLabelDetailsQuery$variables = {
  id: string;
};
export type SandboxConfigLabelDetailsQuery$data = {
  readonly node: {
    readonly __typename: "SandboxConfig";
    readonly config: {
      readonly dependencies: {
        readonly packages: ReadonlyArray<string>;
      } | null;
      readonly envVars: ReadonlyArray<{
        readonly name: string;
        readonly value: {
          readonly __typename: "SandboxConfigEnvVarLiteral";
          readonly literal: string;
        } | {
          readonly __typename: "SandboxConfigEnvVarSecretRef";
          readonly secretKey: string;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        };
      }>;
      readonly internetAccess: {
        readonly mode: InternetAccessChoice;
      } | null;
    };
    readonly timeout: number;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SandboxConfigLabelDetailsQuery = {
  response: SandboxConfigLabelDetailsQuery$data;
  variables: SandboxConfigLabelDetailsQuery$variables;
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
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
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
              "concreteType": null,
              "kind": "LinkedField",
              "name": "value",
              "plural": false,
              "selections": [
                (v2/*: any*/),
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "literal",
                      "storageKey": null
                    }
                  ],
                  "type": "SandboxConfigEnvVarLiteral",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "secretKey",
                      "storageKey": null
                    }
                  ],
                  "type": "SandboxConfigEnvVarSecretRef",
                  "abstractKey": null
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
  "type": "SandboxConfig",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SandboxConfigLabelDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SandboxConfigLabelDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "fbdcf774fd30726c94bda79a5a35ec60",
    "id": null,
    "metadata": {},
    "name": "SandboxConfigLabelDetailsQuery",
    "operationKind": "query",
    "text": "query SandboxConfigLabelDetailsQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on SandboxConfig {\n      timeout\n      config {\n        envVars {\n          name\n          value {\n            __typename\n            ... on SandboxConfigEnvVarLiteral {\n              literal\n            }\n            ... on SandboxConfigEnvVarSecretRef {\n              secretKey\n            }\n          }\n        }\n        internetAccess {\n          mode\n        }\n        dependencies {\n          packages\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "7a710c1e84ea580fa9170ae9c0136798";

export default node;
