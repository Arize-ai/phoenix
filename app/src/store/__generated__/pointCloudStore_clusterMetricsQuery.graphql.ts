/**
 * @generated SignedSource<<8465c15df123394d27e06c0a87c981d1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type ClusterInput = {
  eventIds: ReadonlyArray<string>;
  id?: string | null;
};
export type pointCloudStore_clusterMetricsQuery$variables = {
  clusters: ReadonlyArray<ClusterInput>;
  dataQualityMetricColumnName?: string | null;
  fetchDataQualityMetric: boolean;
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
v3 = [
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
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "pointCloudStore_clusterMetricsQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "pointCloudStore_clusterMetricsQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "cce7e820496ccfd87d2e3db9ee640583",
    "id": null,
    "metadata": {},
    "name": "pointCloudStore_clusterMetricsQuery",
    "operationKind": "query",
    "text": "query pointCloudStore_clusterMetricsQuery(\n  $clusters: [ClusterInput!]!\n  $fetchDataQualityMetric: Boolean!\n  $dataQualityMetricColumnName: String\n) {\n  clusters(clusters: $clusters) {\n    id\n    eventIds\n    driftRatio\n    dataQualityMetric(metric: {metric: mean, columnName: $dataQualityMetricColumnName}) @include(if: $fetchDataQualityMetric) {\n      primaryValue\n      referenceValue\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9b3763586f9b6c654a2ee6fd11624622";

export default node;
