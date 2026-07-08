/**
 * @generated SignedSource<<dec7fc90271e582172cc1fbe705c3d0d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetLabelConfigButtonQuery$variables = {
  datasetId: string;
};
export type DatasetLabelConfigButtonQuery$data = {
  readonly dataset: {
    readonly " $fragmentSpreads": FragmentRefs<"DatasetLabelConfigButton_datasetLabels">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"DatasetLabelConfigButton_allLabels">;
};
export type DatasetLabelConfigButtonQuery = {
  response: DatasetLabelConfigButtonQuery$data;
  variables: DatasetLabelConfigButtonQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v2 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetLabelConfigButtonQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DatasetLabelConfigButton_allLabels"
      },
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DatasetLabelConfigButton_datasetLabels"
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DatasetLabelConfigButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DatasetLabelConnection",
        "kind": "LinkedField",
        "name": "datasetLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetLabelEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DatasetLabel",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v3/*: any*/),
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
                  },
                  (v4/*: any*/)
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
        "storageKey": "datasetLabels(first:100)"
      },
      {
        "alias": null,
        "args": (v2/*: any*/),
        "filters": null,
        "handle": "connection",
        "key": "DatasetLabelConfigButtonAllLabels_datasetLabels",
        "kind": "LinkedHandle",
        "name": "datasetLabels"
      },
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DatasetLabel",
                "kind": "LinkedField",
                "name": "labels",
                "plural": true,
                "selections": [
                  (v3/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8439cb639233813ad16096d7abf8b164",
    "id": null,
    "metadata": {},
    "name": "DatasetLabelConfigButtonQuery",
    "operationKind": "query",
    "text": "query DatasetLabelConfigButtonQuery(\n  $datasetId: ID!\n) {\n  ...DatasetLabelConfigButton_allLabels\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      ...DatasetLabelConfigButton_datasetLabels\n    }\n    id\n  }\n}\n\nfragment DatasetLabelConfigButton_allLabels on Query {\n  datasetLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        color\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment DatasetLabelConfigButton_datasetLabels on Dataset {\n  id\n  labels {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "db621714d07a0ae581155c099d7e2788";

export default node;
