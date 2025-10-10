/**
 * @generated SignedSource<<e64d18392a9006b865b730eace50bf9e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetLabelConfigButtonSetLabelsMutation$variables = {
  datasetIds: ReadonlyArray<string>;
  datasetLabelIds: ReadonlyArray<string>;
};
export type DatasetLabelConfigButtonSetLabelsMutation$data = {
  readonly setDatasetLabels: {
    readonly query: {
      readonly datasets: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly id: string;
            readonly labels: ReadonlyArray<{
              readonly color: string;
              readonly id: string;
              readonly name: string;
            }>;
          };
        }>;
      };
    };
  };
};
export type DatasetLabelConfigButtonSetLabelsMutation = {
  response: DatasetLabelConfigButtonSetLabelsMutation$data;
  variables: DatasetLabelConfigButtonSetLabelsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetIds"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetLabelIds"
  }
],
v1 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "datasetIds",
        "variableName": "datasetIds"
      },
      {
        "kind": "Variable",
        "name": "datasetLabelIds",
        "variableName": "datasetLabelIds"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "DatasetEdge",
    "kind": "LinkedField",
    "name": "edges",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Dataset",
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetLabel",
            "kind": "LinkedField",
            "name": "labels",
            "plural": true,
            "selections": [
              (v2/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "color",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "cursor",
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "PageInfo",
    "kind": "LinkedField",
    "name": "pageInfo",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "endCursor",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "hasNextPage",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v4 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SetDatasetLabelsMutationPayload",
        "kind": "LinkedField",
        "name": "setDatasetLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": "datasets",
                "args": null,
                "concreteType": "DatasetConnection",
                "kind": "LinkedField",
                "name": "__DatasetsTable_datasets_connection",
                "plural": false,
                "selections": (v3/*: any*/),
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SetDatasetLabelsMutationPayload",
        "kind": "LinkedField",
        "name": "setDatasetLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v4/*: any*/),
                "concreteType": "DatasetConnection",
                "kind": "LinkedField",
                "name": "datasets",
                "plural": false,
                "selections": (v3/*: any*/),
                "storageKey": "datasets(first:100)"
              },
              {
                "alias": null,
                "args": (v4/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "DatasetsTable_datasets",
                "kind": "LinkedHandle",
                "name": "datasets"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d0b48583ca2e9d007af0d361e771961e",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "setDatasetLabels",
            "query",
            "datasets"
          ]
        }
      ]
    },
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation DatasetLabelConfigButtonSetLabelsMutation(\n  $datasetIds: [ID!]!\n  $datasetLabelIds: [ID!]!\n) {\n  setDatasetLabels(input: {datasetIds: $datasetIds, datasetLabelIds: $datasetLabelIds}) {\n    query {\n      datasets(first: 100) {\n        edges {\n          node {\n            id\n            labels {\n              id\n              name\n              color\n            }\n            __typename\n          }\n          cursor\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "478f39f175e06a2f8697c5b16d38adfa";

export default node;
