/**
 * @generated SignedSource<<6cf7a80d893154af1bea71228543642d>>
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
    readonly sessionCount?: number;
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
      "alias": null,
      "args": (v3/*: any*/),
      "kind": "ScalarField",
      "name": "sessionCount",
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
    "cacheID": "553ac50ff40ac07db72e898c674e3c53",
    "id": null,
    "metadata": {},
    "name": "ProjectsPageProjectMetricsQuery",
    "operationKind": "query",
    "text": "query ProjectsPageProjectMetricsQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      traceCount(timeRange: $timeRange)\n      sessionCount(timeRange: $timeRange)\n      latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "cf6f06fed15329c04328ddacfbde14d0";

export default node;
