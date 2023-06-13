/**
 * @generated SignedSource<<158f240473ff0a8e7a67fbf6fe9d6dec>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type PerformanceMetric = "accuracyScore";
export type ClusterInput = {
  eventIds: ReadonlyArray<string>;
  id?: string | null;
};
export type pointCloudStore_clusterMetricsQuery$variables = {
  clusters: ReadonlyArray<ClusterInput>;
  dataQualityMetricColumnName?: string | null;
  fetchDataQualityMetric: boolean;
  fetchPerformanceMetric: boolean;
  performanceMetric: PerformanceMetric;
};
export type pointCloudStore_clusterMetricsQuery$data = {
  readonly clusters: ReadonlyArray<{
    readonly dataQualityMetric?: {
      readonly primaryValue: number | null;
      readonly referenceValue: number | null;
    };
    readonly driftRatio: number | null;
    readonly eventIds: ReadonlyArray<string>;
    readonly id: string;
    readonly performanceMetric?: {
      readonly primaryValue: number | null;
      readonly referenceValue: number | null;
    };
  }>;
};
export type pointCloudStore_clusterMetricsQuery = {
  response: pointCloudStore_clusterMetricsQuery$data;
  variables: pointCloudStore_clusterMetricsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "clusters"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "dataQualityMetricColumnName"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "fetchDataQualityMetric"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "fetchPerformanceMetric"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "performanceMetric"
},
v5 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "primaryValue",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "referenceValue",
    "storageKey": null
  }
],
v6 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "clusters",
        "variableName": "clusters"
      }
    ],
    "concreteType": "Cluster",
    "kind": "LinkedField",
    "name": "clusters",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "eventIds",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "driftRatio",
        "storageKey": null
      },
      {
        "condition": "fetchDataQualityMetric",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": [
              {
                "fields": [
                  {
                    "kind": "Variable",
                    "name": "columnName",
                    "variableName": "dataQualityMetricColumnName"
                  },
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "mean"
                  }
                ],
                "kind": "ObjectValue",
                "name": "metric"
              }
            ],
            "concreteType": "DatasetValues",
            "kind": "LinkedField",
            "name": "dataQualityMetric",
            "plural": false,
            "selections": (v5/*: any*/),
            "storageKey": null
          }
        ]
      },
      {
        "condition": "fetchPerformanceMetric",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": [
              {
                "fields": [
                  {
                    "kind": "Variable",
                    "name": "metric",
                    "variableName": "performanceMetric"
                  }
                ],
                "kind": "ObjectValue",
                "name": "metric"
              }
            ],
            "concreteType": "DatasetValues",
            "kind": "LinkedField",
            "name": "performanceMetric",
            "plural": false,
            "selections": (v5/*: any*/),
            "storageKey": null
          }
        ]
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "pointCloudStore_clusterMetricsQuery",
    "selections": (v6/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/)
    ],
    "kind": "Operation",
    "name": "pointCloudStore_clusterMetricsQuery",
    "selections": (v6/*: any*/)
  },
  "params": {
    "cacheID": "e8ef2d6ff8ff0b147a19312264f16ef3",
    "id": null,
    "metadata": {},
    "name": "pointCloudStore_clusterMetricsQuery",
    "operationKind": "query",
    "text": "query pointCloudStore_clusterMetricsQuery(\n  $clusters: [ClusterInput!]!\n  $fetchDataQualityMetric: Boolean!\n  $dataQualityMetricColumnName: String\n  $fetchPerformanceMetric: Boolean!\n  $performanceMetric: PerformanceMetric!\n) {\n  clusters(clusters: $clusters) {\n    id\n    eventIds\n    driftRatio\n    dataQualityMetric(metric: {metric: mean, columnName: $dataQualityMetricColumnName}) @include(if: $fetchDataQualityMetric) {\n      primaryValue\n      referenceValue\n    }\n    performanceMetric(metric: {metric: $performanceMetric}) @include(if: $fetchPerformanceMetric) {\n      primaryValue\n      referenceValue\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fe9bbb56950c7ecfa063c043df7667cd";

export default node;
