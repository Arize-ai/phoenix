/**
 * @generated SignedSource<<f087ab9c3f68dc94c0ccf8c3af62c7ee>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectAnnotationMetricTimeRangeNamesSpanQuery$variables = {
  projectId: string;
  timeRange: TimeRange;
};
export type ProjectAnnotationMetricTimeRangeNamesSpanQuery$data = {
  readonly project: {
    readonly spanAnnotationMetricNames?: ReadonlyArray<string>;
  };
};
export type ProjectAnnotationMetricTimeRangeNamesSpanQuery = {
  response: ProjectAnnotationMetricTimeRangeNamesSpanQuery$data;
  variables: ProjectAnnotationMetricTimeRangeNamesSpanQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
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
    "variableName": "projectId"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "kind": "ScalarField",
      "name": "spanAnnotationMetricNames",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectAnnotationMetricTimeRangeNamesSpanQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectAnnotationMetricTimeRangeNamesSpanQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
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
          (v2/*:: as any*/),
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
    "cacheID": "1757f206d1382138d9880180d2718d70",
    "id": null,
    "metadata": {},
    "name": "ProjectAnnotationMetricTimeRangeNamesSpanQuery",
    "operationKind": "query",
    "text": "query ProjectAnnotationMetricTimeRangeNamesSpanQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      spanAnnotationMetricNames(timeRange: $timeRange)\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "19f5686552fc2341a0b5b88e042f18bc";

export default node;
