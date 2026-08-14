/**
 * @generated SignedSource<<a90001c02fa62f7fd4a92b3ea2a7fce4>>
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
export type ProjectAnnotationMetricTimeRangeNamesTraceQuery$variables = {
  projectId: string;
  timeRange: TimeRange;
};
export type ProjectAnnotationMetricTimeRangeNamesTraceQuery$data = {
  readonly project: {
    readonly traceAnnotationMetricNames?: ReadonlyArray<string>;
  };
};
export type ProjectAnnotationMetricTimeRangeNamesTraceQuery = {
  response: ProjectAnnotationMetricTimeRangeNamesTraceQuery$data;
  variables: ProjectAnnotationMetricTimeRangeNamesTraceQuery$variables;
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
      "name": "traceAnnotationMetricNames",
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
    "name": "ProjectAnnotationMetricTimeRangeNamesTraceQuery",
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
    "name": "ProjectAnnotationMetricTimeRangeNamesTraceQuery",
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
    "cacheID": "72397435acaeeb8c3a5b2a88d9404a3e",
    "id": null,
    "metadata": {},
    "name": "ProjectAnnotationMetricTimeRangeNamesTraceQuery",
    "operationKind": "query",
    "text": "query ProjectAnnotationMetricTimeRangeNamesTraceQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      traceAnnotationMetricNames(timeRange: $timeRange)\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f1df6510bf3bb9db7c8e0e713f6ee3be";

export default node;
