/**
 * @generated SignedSource<<3a9324986e40886fea88900abbd1f555>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type PerformanceMetric = "accuracyScore";
export type InputCoordinate3D = {
  x: number;
  y: number;
  z: number;
};
export type pointCloudStore_clustersQuery$variables = {
  clusterMinSamples: number;
  clusterSelectionEpsilon: number;
  coordinates: ReadonlyArray<InputCoordinate3D>;
  dataQualityMetricColumnName?: string | null;
  eventIds: ReadonlyArray<string>;
  fetchDataQualityMetric: boolean;
  fetchPerformanceMetric: boolean;
  minClusterSize: number;
  performanceMetric: PerformanceMetric;
};
export type pointCloudStore_clustersQuery$data = {
  readonly hdbscanClustering: ReadonlyArray<{
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
export type pointCloudStore_clustersQuery = {
  response: pointCloudStore_clustersQuery$data;
  variables: pointCloudStore_clustersQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "clusterMinSamples"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "clusterSelectionEpsilon"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "coordinates"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "dataQualityMetricColumnName"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "eventIds"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "fetchDataQualityMetric"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "fetchPerformanceMetric"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "minClusterSize"
},
v8 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "performanceMetric"
},
v9 = [
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
v10 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "clusterMinSamples",
        "variableName": "clusterMinSamples"
      },
      {
        "kind": "Variable",
        "name": "clusterSelectionEpsilon",
        "variableName": "clusterSelectionEpsilon"
      },
      {
        "kind": "Variable",
        "name": "coordinates3d",
        "variableName": "coordinates"
      },
      {
        "kind": "Variable",
        "name": "eventIds",
        "variableName": "eventIds"
      },
      {
        "kind": "Variable",
        "name": "minClusterSize",
        "variableName": "minClusterSize"
      }
    ],
    "concreteType": "Cluster",
    "kind": "LinkedField",
    "name": "hdbscanClustering",
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
            "selections": (v9/*: any*/),
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
            "selections": (v9/*: any*/),
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
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/),
      (v8/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "pointCloudStore_clustersQuery",
    "selections": (v10/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v4/*: any*/),
      (v2/*: any*/),
      (v7/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/),
      (v5/*: any*/),
      (v3/*: any*/),
      (v6/*: any*/),
      (v8/*: any*/)
    ],
    "kind": "Operation",
    "name": "pointCloudStore_clustersQuery",
    "selections": (v10/*: any*/)
  },
  "params": {
    "cacheID": "6f74afd7fff7f035a547d33c9e35053b",
    "id": null,
    "metadata": {},
    "name": "pointCloudStore_clustersQuery",
    "operationKind": "query",
    "text": "query pointCloudStore_clustersQuery(\n  $eventIds: [ID!]!\n  $coordinates: [InputCoordinate3D!]!\n  $minClusterSize: Int!\n  $clusterMinSamples: Int!\n  $clusterSelectionEpsilon: Float!\n  $fetchDataQualityMetric: Boolean!\n  $dataQualityMetricColumnName: String\n  $fetchPerformanceMetric: Boolean!\n  $performanceMetric: PerformanceMetric!\n) {\n  hdbscanClustering(eventIds: $eventIds, coordinates3d: $coordinates, minClusterSize: $minClusterSize, clusterMinSamples: $clusterMinSamples, clusterSelectionEpsilon: $clusterSelectionEpsilon) {\n    id\n    eventIds\n    driftRatio\n    dataQualityMetric(metric: {metric: mean, columnName: $dataQualityMetricColumnName}) @include(if: $fetchDataQualityMetric) {\n      primaryValue\n      referenceValue\n    }\n    performanceMetric(metric: {metric: $performanceMetric}) @include(if: $fetchPerformanceMetric) {\n      primaryValue\n      referenceValue\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4371042b8b65df77c8cba441031be7a0";

export default node;
