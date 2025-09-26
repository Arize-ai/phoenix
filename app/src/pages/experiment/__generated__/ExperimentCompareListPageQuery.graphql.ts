/**
 * @generated SignedSource<<8e4957bc19b3c4abbf5f7ded3edf65f3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareListPageQuery$variables = {
  after?: string | null;
  baseExperimentId: string;
  compareExperimentIds: ReadonlyArray<string>;
  first?: number | null;
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
    "name": "after"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "baseExperimentId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "compareExperimentIds"
  },
  {
    "defaultValue": 50,
    "kind": "LocalArgument",
    "name": "first"
  }
],
v1 = {
  "kind": "Variable",
  "name": "after",
  "variableName": "after"
},
v2 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = [
  (v1/*: any*/),
  (v2/*: any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanCostSummary",
  "kind": "LinkedField",
  "name": "costSummary",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "total",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "tokens",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cost",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "ExperimentRunAnnotationConnection",
  "kind": "LinkedField",
  "name": "annotations",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ExperimentRunAnnotationEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": "annotation",
          "args": null,
          "concreteType": "ExperimentRunAnnotation",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
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
            (v4/*: any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
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
          (v1/*: any*/),
          {
            "kind": "Variable",
            "name": "baseExperimentId",
            "variableName": "baseExperimentId"
          },
          {
            "kind": "Variable",
            "name": "compareExperimentIds",
            "variableName": "compareExperimentIds"
          },
          (v2/*: any*/)
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
          (v3/*: any*/),
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v5/*: any*/),
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
                          (v4/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "repetitionNumber",
                            "storageKey": null
                          },
                          (v6/*: any*/),
                          (v7/*: any*/),
                          (v8/*: any*/),
                          (v9/*: any*/),
                          (v10/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DatasetExample",
                            "kind": "LinkedField",
                            "name": "example",
                            "plural": false,
                            "selections": [
                              (v4/*: any*/),
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
                                    "name": "experimentIds",
                                    "variableName": "compareExperimentIds"
                                  }
                                ],
                                "concreteType": "ExperimentRepeatedRunGroup",
                                "kind": "LinkedField",
                                "name": "experimentRepeatedRunGroups",
                                "plural": true,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "experimentId",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "ExperimentRun",
                                    "kind": "LinkedField",
                                    "name": "runs",
                                    "plural": true,
                                    "selections": [
                                      (v4/*: any*/),
                                      (v6/*: any*/),
                                      (v7/*: any*/),
                                      (v8/*: any*/),
                                      (v9/*: any*/),
                                      (v10/*: any*/)
                                    ],
                                    "storageKey": null
                                  },
                                  (v4/*: any*/)
                                ],
                                "storageKey": null
                              }
                            ],
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
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentRun",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v4/*: any*/)
                        ],
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
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v5/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "ExperimentCompareListPage_runs",
                "kind": "LinkedHandle",
                "name": "runs"
              }
            ],
            "type": "Experiment",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ecb703201a73e6f0cf4907257a0087c0",
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareListPageQuery",
    "operationKind": "query",
    "text": "query ExperimentCompareListPageQuery(\n  $after: String = null\n  $baseExperimentId: ID!\n  $compareExperimentIds: [ID!]!\n  $first: Int = 50\n) {\n  ...ExperimentCompareListPage_comparisons_2R0tQo\n}\n\nfragment ExperimentCompareListPage_comparisons_2R0tQo on Query {\n  experiment: node(id: $baseExperimentId) {\n    __typename\n    ... on Experiment {\n      id\n      runs(first: $first, after: $after) {\n        edges {\n          run: node {\n            id\n            repetitionNumber\n            output\n            startTime\n            endTime\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  name\n                  score\n                  label\n                  id\n                }\n              }\n            }\n            example {\n              id\n              revision {\n                input\n                referenceOutput: output\n              }\n              experimentRepeatedRunGroups(experimentIds: $compareExperimentIds) {\n                experimentId\n                runs {\n                  id\n                  output\n                  startTime\n                  endTime\n                  costSummary {\n                    total {\n                      tokens\n                      cost\n                    }\n                  }\n                  annotations {\n                    edges {\n                      annotation: node {\n                        name\n                        score\n                        label\n                        id\n                      }\n                    }\n                  }\n                }\n                id\n              }\n            }\n          }\n          cursor\n          node {\n            __typename\n            id\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "c2010c992e145834d41d622abbb57522";

export default node;
