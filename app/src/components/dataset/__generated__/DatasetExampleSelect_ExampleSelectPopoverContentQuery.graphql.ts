/**
 * @generated SignedSource<<dbf91963308edc60385bfbec6065d031>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetExampleSelect_ExampleSelectPopoverContentQuery$variables = {
  datasetId: string;
  hasDataset: boolean;
};
export type DatasetExampleSelect_ExampleSelectPopoverContentQuery$data = {
  readonly dataset?: {
    readonly examples?: {
      readonly edges: ReadonlyArray<{
        readonly example: {
          readonly id: string;
        };
      }>;
    };
  };
};
export type DatasetExampleSelect_ExampleSelectPopoverContentQuery = {
  response: DatasetExampleSelect_ExampleSelectPopoverContentQuery$data;
  variables: DatasetExampleSelect_ExampleSelectPopoverContentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "hasDataset"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 10
        }
      ],
      "concreteType": "DatasetExampleConnection",
      "kind": "LinkedField",
      "name": "examples",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetExampleEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "example",
              "args": null,
              "concreteType": "DatasetExample",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v2/*: any*/)
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "examples(first:10)"
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetExampleSelect_ExampleSelectPopoverContentQuery",
    "selections": [
      {
        "condition": "hasDataset",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "dataset",
            "args": (v1/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v3/*: any*/)
            ],
            "storageKey": null
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DatasetExampleSelect_ExampleSelectPopoverContentQuery",
    "selections": [
      {
        "condition": "hasDataset",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "dataset",
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
              (v3/*: any*/),
              (v2/*: any*/)
            ],
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "2af54236bec5f97b7b4e60085f5620aa",
    "id": null,
    "metadata": {},
    "name": "DatasetExampleSelect_ExampleSelectPopoverContentQuery",
    "operationKind": "query",
    "text": "query DatasetExampleSelect_ExampleSelectPopoverContentQuery(\n  $datasetId: ID!\n  $hasDataset: Boolean!\n) {\n  dataset: node(id: $datasetId) @include(if: $hasDataset) {\n    __typename\n    ... on Dataset {\n      examples(first: 10) {\n        edges {\n          example: node {\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "d214c22e01589abf05985103db2435d0";

export default node;
