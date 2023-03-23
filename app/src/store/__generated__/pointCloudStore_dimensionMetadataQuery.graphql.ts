/**
 * @generated SignedSource<<4f4f811563b92a600fd003c5b45a23d0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type pointCloudStore_dimensionMetadataQuery$variables = {
  getDimensionCategories: boolean;
  getDimensionMinMax: boolean;
  id: string;
};
export type pointCloudStore_dimensionMetadataQuery$data = {
  readonly dimension: {
    readonly categories?: ReadonlyArray<string>;
    readonly id?: string;
    readonly max?: number | null;
    readonly min?: number | null;
  };
};
export type pointCloudStore_dimensionMetadataQuery = {
  response: pointCloudStore_dimensionMetadataQuery$data;
  variables: pointCloudStore_dimensionMetadataQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "getDimensionCategories"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "getDimensionMinMax"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "condition": "getDimensionMinMax",
  "kind": "Condition",
  "passingValue": true,
  "selections": [
    {
      "alias": "min",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "min"
        }
      ],
      "kind": "ScalarField",
      "name": "dataQualityMetric",
      "storageKey": "dataQualityMetric(metric:\"min\")"
    },
    {
      "alias": "max",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "max"
        }
      ],
      "kind": "ScalarField",
      "name": "dataQualityMetric",
      "storageKey": "dataQualityMetric(metric:\"max\")"
    }
  ]
},
v6 = {
  "condition": "getDimensionCategories",
  "kind": "Condition",
  "passingValue": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "categories",
      "storageKey": null
    }
  ]
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "pointCloudStore_dimensionMetadataQuery",
    "selections": [
      {
        "kind": "RequiredField",
        "field": {
          "alias": "dimension",
          "args": (v3/*: any*/),
          "concreteType": null,
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            {
              "kind": "InlineFragment",
              "selections": [
                (v4/*: any*/),
                (v5/*: any*/),
                (v6/*: any*/)
              ],
              "type": "Dimension",
              "abstractKey": null
            }
          ],
          "storageKey": null
        },
        "action": "THROW",
        "path": "dimension"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "pointCloudStore_dimensionMetadataQuery",
    "selections": [
      {
        "alias": "dimension",
        "args": (v3/*: any*/),
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
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*: any*/),
              (v6/*: any*/)
            ],
            "type": "Dimension",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "79c15606d5694bd068270b42ed2fe74c",
    "id": null,
    "metadata": {},
    "name": "pointCloudStore_dimensionMetadataQuery",
    "operationKind": "query",
    "text": "query pointCloudStore_dimensionMetadataQuery(\n  $id: GlobalID!\n  $getDimensionMinMax: Boolean!\n  $getDimensionCategories: Boolean!\n) {\n  dimension: node(id: $id) {\n    __typename\n    ... on Dimension {\n      id\n      min: dataQualityMetric(metric: min) @include(if: $getDimensionMinMax)\n      max: dataQualityMetric(metric: max) @include(if: $getDimensionMinMax)\n      categories @include(if: $getDimensionCategories)\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e8fa488a0d466b5e40fdadc1e5227a57";

export default node;
