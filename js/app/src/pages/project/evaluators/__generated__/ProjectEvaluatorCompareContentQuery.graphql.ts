/**
 * @generated SignedSource<<cbe21bd7c07990ff119ca2e888bc9722>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectEvaluatorCompareContentQuery$variables = {
  evaluatorAId: string;
  evaluatorBId: string;
  projectId: string;
  timeRange: TimeRange;
};
export type ProjectEvaluatorCompareContentQuery$data = {
  readonly project: {
    readonly __typename: "Project";
    readonly evaluatorComparison: {
      readonly coverage: {
        readonly evaluatedByBoth: number;
        readonly onlyA: number;
        readonly onlyB: number;
        readonly totalInRange: number;
      };
      readonly evaluationTarget: EvaluationTarget;
      readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_comparison" | "ProjectEvaluatorCompareMatrix_comparison" | "ProjectEvaluatorCompareStats_comparison">;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type ProjectEvaluatorCompareContentQuery = {
  response: ProjectEvaluatorCompareContentQuery$data;
  variables: ProjectEvaluatorCompareContentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "evaluatorAId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "evaluatorBId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = [
  {
    "kind": "Variable",
    "name": "evaluatorAId",
    "variableName": "evaluatorAId"
  },
  {
    "kind": "Variable",
    "name": "evaluatorBId",
    "variableName": "evaluatorBId"
  },
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluatorComparisonCoverage",
  "kind": "LinkedField",
  "name": "coverage",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluatedByBoth",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "onlyA",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "onlyB",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "totalInRange",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v11 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "annotationName",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "flaggedCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "flagRate",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "sharedMeanScore",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "threshold",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "allEvaluatedMeanScore",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "scoreBinEdges",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "scoreBinCounts",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "EvaluatorScoreValueCount",
    "kind": "LinkedField",
    "name": "scoreValueCounts",
    "plural": true,
    "selections": [
      (v9/*:: as any*/),
      (v10/*:: as any*/)
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "EvaluatorLabelCount",
    "kind": "LinkedField",
    "name": "labelCounts",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "label",
        "storageKey": null
      },
      (v9/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "isOther",
        "storageKey": null
      },
      (v10/*:: as any*/)
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "labels",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorCompareContentQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v6/*:: as any*/),
                "concreteType": "ProjectEvaluatorComparison",
                "kind": "LinkedField",
                "name": "evaluatorComparison",
                "plural": false,
                "selections": [
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ProjectEvaluatorCompareStats_comparison"
                  },
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ProjectEvaluatorCompareDistributions_comparison"
                  },
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ProjectEvaluatorCompareMatrix_comparison"
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
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
    "argumentDefinitions": [
      (v2/*:: as any*/),
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorCompareContentQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v6/*:: as any*/),
                "concreteType": "ProjectEvaluatorComparison",
                "kind": "LinkedField",
                "name": "evaluatorComparison",
                "plural": false,
                "selections": [
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorComparisonSide",
                    "kind": "LinkedField",
                    "name": "sideA",
                    "plural": false,
                    "selections": (v11/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorComparisonSide",
                    "kind": "LinkedField",
                    "name": "sideB",
                    "plural": false,
                    "selections": (v11/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorComparisonStatistics",
                    "kind": "LinkedField",
                    "name": "statistics",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "agreement",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "cohensKappa",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "spearmanRho",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "disagreementCount",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "confusionMatrix",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e0cf6318d89d5e487b02a40acc66d950",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorCompareContentQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorCompareContentQuery(\n  $projectId: ID!\n  $evaluatorAId: ID!\n  $evaluatorBId: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluatorComparison(evaluatorAId: $evaluatorAId, evaluatorBId: $evaluatorBId, timeRange: $timeRange) {\n        evaluationTarget\n        coverage {\n          evaluatedByBoth\n          onlyA\n          onlyB\n          totalInRange\n        }\n        ...ProjectEvaluatorCompareStats_comparison\n        ...ProjectEvaluatorCompareDistributions_comparison\n        ...ProjectEvaluatorCompareMatrix_comparison\n      }\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorCompareDistributions_comparison on ProjectEvaluatorComparison {\n  evaluationTarget\n  coverage {\n    evaluatedByBoth\n    onlyA\n    onlyB\n  }\n  sideA {\n    threshold\n    allEvaluatedMeanScore\n    scoreBinEdges\n    scoreBinCounts\n    scoreValueCounts {\n      score\n      count\n    }\n    labelCounts {\n      label\n      score\n      isOther\n      count\n    }\n  }\n  sideB {\n    threshold\n    allEvaluatedMeanScore\n    scoreBinEdges\n    scoreBinCounts\n    scoreValueCounts {\n      score\n      count\n    }\n    labelCounts {\n      label\n      score\n      isOther\n      count\n    }\n  }\n}\n\nfragment ProjectEvaluatorCompareMatrix_comparison on ProjectEvaluatorComparison {\n  evaluationTarget\n  coverage {\n    evaluatedByBoth\n  }\n  sideA {\n    annotationName\n    labels\n    threshold\n  }\n  sideB {\n    annotationName\n    labels\n    threshold\n  }\n  confusionMatrix\n}\n\nfragment ProjectEvaluatorCompareStats_comparison on ProjectEvaluatorComparison {\n  evaluationTarget\n  coverage {\n    evaluatedByBoth\n    onlyA\n    onlyB\n    totalInRange\n  }\n  sideA {\n    annotationName\n    flaggedCount\n    flagRate\n    sharedMeanScore\n  }\n  sideB {\n    annotationName\n    flaggedCount\n    flagRate\n    sharedMeanScore\n  }\n  statistics {\n    agreement\n    cohensKappa\n    spearmanRho\n    disagreementCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "d508c16fbfbbf5f3391476ee6b18db56";

export default node;
