/**
<<<<<<< HEAD
 * @generated SignedSource<<929578f1485134a0d3f7b0576fa00506>>
=======
 * @generated SignedSource<<b792be1cda6c162b163dc9a32a940cae>>
>>>>>>> b3115f7ca (replace compareExperiments query with experiments resolver on list page)
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareListPageQuery$variables = {
  baseExperimentId: string;
  compareExperimentIds: ReadonlyArray<string>;
};
export type ExperimentCompareListPageQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareListPage_comparisons">;
};
export type ExperimentCompareListPageQuery = {
  response: ExperimentCompareListPageQuery$data;
  variables: ExperimentCompareListPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "baseExperimentId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "compareExperimentIds"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentCompareListPageQuery",
    "selections": [
      {
        "args": [
          {
            "kind": "Variable",
            "name": "baseExperimentId",
            "variableName": "baseExperimentId"
          },
          {
            "kind": "Variable",
            "name": "compareExperimentIds",
            "variableName": "compareExperimentIds"
          }
        ],
        "kind": "FragmentSpread",
        "name": "ExperimentCompareListPage_comparisons"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExperimentCompareListPageQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": [
          {
            "kind": "Variable",
            "name": "id",
            "variableName": "baseExperimentId"
          }
        ],
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
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 50
                  }
                ],
                "concreteType": "ExperimentRunConnection",
                "kind": "LinkedField",
                "name": "runs",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "run",
                        "args": null,
                        "concreteType": "ExperimentRun",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v1/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DatasetExample",
                            "kind": "LinkedField",
                            "name": "example",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "DatasetExampleRevision",
                                "kind": "LinkedField",
                                "name": "revision",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "input",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": "referenceOutput",
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "output",
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": [
                                  {
                                    "kind": "Variable",
                                    "name": "filterIds",
                                    "variableName": "compareExperimentIds"
                                  }
                                ],
                                "concreteType": "ExperimentConnection",
                                "kind": "LinkedField",
                                "name": "experiments",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "ExperimentEdge",
                                    "kind": "LinkedField",
                                    "name": "edges",
                                    "plural": true,
                                    "selections": [
                                      {
                                        "alias": "experiment",
                                        "args": null,
                                        "concreteType": "Experiment",
                                        "kind": "LinkedField",
                                        "name": "node",
                                        "plural": false,
                                        "selections": [
                                          {
                                            "alias": null,
                                            "args": [
                                              {
                                                "kind": "Literal",
                                                "name": "first",
                                                "value": 5
                                              }
                                            ],
                                            "concreteType": "ExperimentRunConnection",
                                            "kind": "LinkedField",
                                            "name": "runs",
                                            "plural": false,
                                            "selections": [
                                              {
                                                "alias": null,
                                                "args": null,
                                                "concreteType": "ExperimentRunEdge",
                                                "kind": "LinkedField",
                                                "name": "edges",
                                                "plural": true,
                                                "selections": [
                                                  {
                                                    "alias": "run",
                                                    "args": null,
                                                    "concreteType": "ExperimentRun",
                                                    "kind": "LinkedField",
                                                    "name": "node",
                                                    "plural": false,
                                                    "selections": [
                                                      (v2/*: any*/),
                                                      (v1/*: any*/)
                                                    ],
                                                    "storageKey": null
                                                  }
                                                ],
                                                "storageKey": null
                                              }
                                            ],
                                            "storageKey": "runs(first:5)"
                                          },
                                          (v1/*: any*/)
                                        ],
                                        "storageKey": null
<<<<<<< HEAD
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "score",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "label",
                                        "storageKey": null
                                      },
                                      (v5/*: any*/)
=======
                                      }
>>>>>>> b3115f7ca (replace compareExperiments query with experiments resolver on list page)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v1/*: any*/)
                            ],
                            "storageKey": null
                          },
                          (v2/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "runs(first:50)"
              }
            ],
            "type": "Experiment",
            "abstractKey": null
          },
          (v1/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
<<<<<<< HEAD
    "cacheID": "bd1f30ed09f9550e6a8be6fc7d44c3d2",
=======
    "cacheID": "2ad81244c96e06aa520f6712197a115d",
>>>>>>> b3115f7ca (replace compareExperiments query with experiments resolver on list page)
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareListPageQuery",
    "operationKind": "query",
<<<<<<< HEAD
    "text": "query ExperimentCompareListPageQuery(\n  $after: String = null\n  $baseExperimentId: ID!\n  $compareExperimentIds: [ID!]!\n  $first: Int = 50\n) {\n  ...ExperimentCompareListPage_comparisons_2H9k7i\n}\n\nfragment ExperimentCompareListPage_comparisons_2H9k7i on Query {\n  compareExperiments(first: $first, after: $after, baseExperimentId: $baseExperimentId, compareExperimentIds: $compareExperimentIds) {\n    edges {\n      comparison: node {\n        example {\n          id\n          revision {\n            input\n            referenceOutput: output\n          }\n        }\n        runComparisonItems {\n          experimentId\n          runs {\n            output\n            startTime\n            endTime\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  name\n                  score\n                  label\n                  id\n                }\n              }\n            }\n            id\n          }\n        }\n        id\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
=======
    "text": "query ExperimentCompareListPageQuery(\n  $baseExperimentId: ID!\n  $compareExperimentIds: [ID!]!\n) {\n  ...ExperimentCompareListPage_comparisons_2bWqNi\n}\n\nfragment ExperimentCompareListPage_comparisons_2bWqNi on Query {\n  experiment: node(id: $baseExperimentId) {\n    __typename\n    ... on Experiment {\n      runs(first: 50) {\n        edges {\n          run: node {\n            id\n            example {\n              revision {\n                input\n                referenceOutput: output\n              }\n              experiments(filterIds: $compareExperimentIds) {\n                edges {\n                  experiment: node {\n                    runs(first: 5) {\n                      edges {\n                        run: node {\n                          output\n                          id\n                        }\n                      }\n                    }\n                    id\n                  }\n                }\n              }\n              id\n            }\n            output\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
>>>>>>> b3115f7ca (replace compareExperiments query with experiments resolver on list page)
  }
};
})();

<<<<<<< HEAD
(node as any).hash = "f3335f76cb2dfb773cd5e57b31cc6a33";
=======
(node as any).hash = "28538e13708b6432ad5f3aaa6659c63d";
>>>>>>> b3115f7ca (replace compareExperiments query with experiments resolver on list page)

export default node;
