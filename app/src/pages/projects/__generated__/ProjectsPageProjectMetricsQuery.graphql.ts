/**
 * @generated SignedSource<<0efbb46067c445179fe9177d41323c7b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectsPageProjectMetricsQuery$variables = {
  id: string;
  timeRange: TimeRange;
};
export type ProjectsPageProjectMetricsQuery$data = {
  readonly project: {
    readonly latencyMsP50?: number | null;
    readonly tokenCountTotal?: number;
    readonly traceCount?: number;
  };
};
export type ProjectsPageProjectMetricsQuery = {
  response: ProjectsPageProjectMetricsQuery$data;
  variables: ProjectsPageProjectMetricsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
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
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v3 = [
  (v2/*: any*/)
],
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": (v3/*: any*/),
      "kind": "ScalarField",
      "name": "traceCount",
      "storageKey": null
    },
    {
      "alias": "latencyMsP50",
      "args": [
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v2/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v3/*: any*/),
      "kind": "ScalarField",
      "name": "tokenCountTotal",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectsPageProjectMetricsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/)
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
    "name": "ProjectsPageProjectMetricsQuery",
    "selections": [
      {
        "alias": "project",
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
          (v4/*: any*/),
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "0fa41a7d0406cd916f93bbafcb5fe94f",
    "id": null,
    "metadata": {},
    "name": "ProjectsPageProjectMetricsQuery",
    "operationKind": "query",
    "text": "query ProjectsPageProjectMetricsQuery(\n  $id: GlobalID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      traceCount(timeRange: $timeRange)\n      latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)\n      tokenCountTotal(timeRange: $timeRange)\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "abe4527bcaa911eb401e05797a984c38";

export default node;
