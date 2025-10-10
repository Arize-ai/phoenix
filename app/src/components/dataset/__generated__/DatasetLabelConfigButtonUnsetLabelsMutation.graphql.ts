/**
 * @generated SignedSource<<12d36b1d05c2eaa71cb34b40df7045b1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetLabelConfigButtonUnsetLabelsMutation$variables = {
  datasetIds: ReadonlyArray<string>;
  datasetLabelIds: ReadonlyArray<string>;
};
export type DatasetLabelConfigButtonUnsetLabelsMutation$data = {
  readonly unsetDatasetLabels: {
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
export type DatasetLabelConfigButtonUnsetLabelsMutation = {
  response: DatasetLabelConfigButtonUnsetLabelsMutation$data;
  variables: DatasetLabelConfigButtonUnsetLabelsMutation$variables;
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
    "name": "DatasetLabelConfigButtonUnsetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UnsetDatasetLabelsMutationPayload",
        "kind": "LinkedField",
        "name": "unsetDatasetLabels",
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
    "name": "DatasetLabelConfigButtonUnsetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UnsetDatasetLabelsMutationPayload",
        "kind": "LinkedField",
        "name": "unsetDatasetLabels",
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
    "cacheID": "631b77fd6da8360dc4b65f3aa6cfacac",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "unsetDatasetLabels",
            "query",
            "datasets"
          ]
        }
      ]
    },
    "name": "DatasetLabelConfigButtonUnsetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation DatasetLabelConfigButtonUnsetLabelsMutation(\n  $datasetIds: [ID!]!\n  $datasetLabelIds: [ID!]!\n) {\n  unsetDatasetLabels(input: {datasetIds: $datasetIds, datasetLabelIds: $datasetLabelIds}) {\n    query {\n      datasets(first: 100) {\n        edges {\n          node {\n            id\n            labels {\n              id\n              name\n              color\n            }\n            __typename\n          }\n          cursor\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2b1e0a9441566ccfded59413981c6168";

export default node;
