/**
 * @generated SignedSource<<7ce8e146cdd35164cae3ca73efc7d9d7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
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
  minClusterSize: number;
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
  "name": "minClusterSize"
},
v7 = [
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
            "selections": [
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
      (v6/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "pointCloudStore_clustersQuery",
    "selections": (v7/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v4/*: any*/),
      (v2/*: any*/),
      (v6/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/),
      (v5/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Operation",
    "name": "pointCloudStore_clustersQuery",
    "selections": (v7/*: any*/)
  },
  "params": {
    "cacheID": "15c0c57dc9a7aaad4bb296b035f349af",
    "id": null,
    "metadata": {},
    "name": "pointCloudStore_clustersQuery",
    "operationKind": "query",
    "text": "query pointCloudStore_clustersQuery(\n  $eventIds: [ID!]!\n  $coordinates: [InputCoordinate3D!]!\n  $minClusterSize: Int!\n  $clusterMinSamples: Int!\n  $clusterSelectionEpsilon: Float!\n  $fetchDataQualityMetric: Boolean!\n  $dataQualityMetricColumnName: String\n) {\n  hdbscanClustering(eventIds: $eventIds, coordinates3d: $coordinates, minClusterSize: $minClusterSize, clusterMinSamples: $clusterMinSamples, clusterSelectionEpsilon: $clusterSelectionEpsilon) {\n    id\n    eventIds\n    driftRatio\n    dataQualityMetric(metric: {metric: mean, columnName: $dataQualityMetricColumnName}) @include(if: $fetchDataQualityMetric) {\n      primaryValue\n      referenceValue\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "abe84c17b7d84edc705986facfbb2c92";

export default node;
