/**
 * @generated SignedSource<<67f3d5d708ee31ce43c3bb4ea3e77795>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageHeaderQuery$variables = {
  id: string;
};
export type ProjectPageHeaderQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeader_stats">;
  };
};
export type ProjectPageHeaderQuery = {
  response: ProjectPageHeaderQuery$data;
  variables: ProjectPageHeaderQuery$variables;
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageHeaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "ProjectPageHeader_stats"
          }
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
    "name": "ProjectPageHeaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "traceCount",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "tokenCountTotal",
                "storageKey": null
              },
              {
                "alias": "latencyMsP50",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "probability",
                    "value": 0.5
                  }
                ],
                "kind": "ScalarField",
                "name": "latencyMsQuantile",
                "storageKey": "latencyMsQuantile(probability:0.5)"
              },
              {
                "alias": "latencyMsP99",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "probability",
                    "value": 0.99
                  }
                ],
                "kind": "ScalarField",
                "name": "latencyMsQuantile",
                "storageKey": "latencyMsQuantile(probability:0.99)"
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "spanEvaluationNames",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "documentEvaluationNames",
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "badea9b7c017c62c14b05faa2cf3fb41",
    "id": null,
    "metadata": {},
    "name": "ProjectPageHeaderQuery",
    "operationKind": "query",
    "text": "query ProjectPageHeaderQuery(\n  $id: GlobalID!\n) {\n  node(id: $id) {\n    __typename\n    ...ProjectPageHeader_stats\n    __isNode: __typename\n    id\n  }\n}\n\nfragment ProjectPageHeader_stats on Project {\n  traceCount\n  tokenCountTotal\n  latencyMsP50: latencyMsQuantile(probability: 0.5)\n  latencyMsP99: latencyMsQuantile(probability: 0.99)\n  spanEvaluationNames\n  documentEvaluationNames\n  id\n}\n"
  }
};
})();

(node as any).hash = "9d1c4be9bade9017039ac1969a3cda40";

export default node;
