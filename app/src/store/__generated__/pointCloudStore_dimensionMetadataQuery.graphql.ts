/**
 * @generated SignedSource<<28226eea86d88dfb09b61d94c61b054e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
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
        "action": "THROW"
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
    "cacheID": "cc8c5b634ad1f06e595b1542b2f9830b",
    "id": null,
    "metadata": {},
    "name": "pointCloudStore_dimensionMetadataQuery",
    "operationKind": "query",
    "text": "query pointCloudStore_dimensionMetadataQuery(\n  $id: ID!\n  $getDimensionMinMax: Boolean!\n  $getDimensionCategories: Boolean!\n) {\n  dimension: node(id: $id) {\n    __typename\n    ... on Dimension {\n      id\n      min: dataQualityMetric(metric: min) @include(if: $getDimensionMinMax)\n      max: dataQualityMetric(metric: max) @include(if: $getDimensionMinMax)\n      categories @include(if: $getDimensionCategories)\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "2d61766d79c27d5fe1d17dba940dfe52";

export default node;
