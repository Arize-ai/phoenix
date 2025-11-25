/**
 * @generated SignedSource<<286ae592277d9271ef5e150a451c8043>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type datasetEvaluatorsLoaderQuery$variables = {
  id: string;
};
export type datasetEvaluatorsLoaderQuery$data = {
  readonly dataset: {
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_evaluators" | "EvaluatorConfigDialog_dataset">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"AddEvaluatorMenu_query">;
};
export type datasetEvaluatorsLoaderQuery = {
  response: datasetEvaluatorsLoaderQuery$data;
  variables: datasetEvaluatorsLoaderQuery$variables;
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
v3 = [
  {
    "kind": "Variable",
    "name": "datasetId",
    "variableName": "id"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "datasetEvaluatorsLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "EvaluatorConfigDialog_dataset"
              },
              {
                "args": (v3/*: any*/),
                "kind": "FragmentSpread",
                "name": "DatasetEvaluatorsTable_evaluators"
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      {
        "args": (v3/*: any*/),
        "kind": "FragmentSpread",
        "name": "AddEvaluatorMenu_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "datasetEvaluatorsLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*: any*/),
              {
                "alias": null,
                "args": (v6/*: any*/),
                "concreteType": "EvaluatorConnection",
                "kind": "LinkedField",
                "name": "evaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v4/*: any*/),
                          {
                            "kind": "TypeDiscriminator",
                            "abstractKey": "__isEvaluator"
                          },
                          (v2/*: any*/),
                          (v5/*: any*/),
                          (v7/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "description",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "createdAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "updatedAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": (v3/*: any*/),
                            "kind": "ScalarField",
                            "name": "isAssignedToDataset",
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
                  },
                  {
                    "kind": "ClientExtension",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "__id",
                        "storageKey": null
                      }
                    ]
                  }
                ],
                "storageKey": "evaluators(first:100)"
              },
              {
                "alias": null,
                "args": (v6/*: any*/),
                "filters": [
                  "sort",
                  "filter"
                ],
                "handle": "connection",
                "key": "DatasetEvaluatorsTable_evaluators",
                "kind": "LinkedHandle",
                "name": "evaluators"
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "BuiltInEvaluator",
        "kind": "LinkedField",
        "name": "builtInEvaluators",
        "plural": true,
        "selections": [
          (v2/*: any*/),
          (v5/*: any*/),
          (v7/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a9ddabf4927aead338f0dd407258f6cd",
    "id": null,
    "metadata": {},
    "name": "datasetEvaluatorsLoaderQuery",
    "operationKind": "query",
    "text": "query datasetEvaluatorsLoaderQuery(\n  $id: ID!\n) {\n  dataset: node(id: $id) {\n    __typename\n    id\n    ... on Dataset {\n      id\n      ...EvaluatorConfigDialog_dataset\n      ...DatasetEvaluatorsTable_evaluators_2m4mqp\n    }\n  }\n  ...AddEvaluatorMenu_query_2m4mqp\n}\n\nfragment AddEvaluatorMenu_codeEvaluatorTemplates on Query {\n  builtInEvaluators {\n    id\n    name\n    kind\n  }\n}\n\nfragment AddEvaluatorMenu_query_2m4mqp on Query {\n  ...AddEvaluatorMenu_codeEvaluatorTemplates\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      ...EvaluatorConfigDialog_dataset\n    }\n    id\n  }\n}\n\nfragment DatasetEvaluatorsTable_evaluators_2m4mqp on Dataset {\n  evaluators(first: 100) {\n    edges {\n      node {\n        __typename\n        ...EvaluatorsTable_row_2m4mqp\n        id\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment EvaluatorConfigDialog_dataset on Dataset {\n  id\n  name\n}\n\nfragment EvaluatorsTable_row_2m4mqp on Evaluator {\n  __isEvaluator: __typename\n  id\n  name\n  kind\n  description\n  createdAt\n  updatedAt\n  isAssignedToDataset(datasetId: $id)\n}\n"
  }
};
})();

(node as any).hash = "7ef3d802d8b5ca5a590bb4fa3eedd877";

export default node;
