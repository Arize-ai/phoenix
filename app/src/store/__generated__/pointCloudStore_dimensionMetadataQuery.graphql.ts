/**
 * @generated SignedSource<<0f6e3251f8d061d67c284055cb7545b6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type pointCloudStore_dimensionMetadataQuery$variables = {
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
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
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
v4 = {
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
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "categories",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "pointCloudStore_dimensionMetadataQuery",
    "selections": [
      {
        "kind": "RequiredField",
        "field": {
          "alias": "dimension",
          "args": (v1/*: any*/),
          "concreteType": null,
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            {
              "kind": "InlineFragment",
              "selections": [
                (v2/*: any*/),
                (v3/*: any*/),
                (v4/*: any*/),
                (v5/*: any*/)
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "pointCloudStore_dimensionMetadataQuery",
    "selections": [
      {
        "alias": "dimension",
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
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/)
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
    "cacheID": "5e7eeb202d64c4268adc8961b23c2121",
    "id": null,
    "metadata": {},
    "name": "pointCloudStore_dimensionMetadataQuery",
    "operationKind": "query",
    "text": "query pointCloudStore_dimensionMetadataQuery(\n  $id: GlobalID!\n) {\n  dimension: node(id: $id) {\n    __typename\n    ... on Dimension {\n      id\n      min: dataQualityMetric(metric: min)\n      max: dataQualityMetric(metric: max)\n      categories\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5ebf4d634228e074af7cb3ce76892a9a";

export default node;
