/**
 * @generated SignedSource<<3c6a999482a32e3e93337807def72da1>>
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
  readonly evaluatorA: {
    readonly __typename: "ProjectEvaluator";
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_evaluator">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly evaluatorB: {
    readonly __typename: "ProjectEvaluator";
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_evaluator">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
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
      readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareMatrix_comparison" | "ProjectEvaluatorCompareStats_comparison">;
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
v6 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v7 = [
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
  (v6/*:: as any*/)
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
  "storageKey": null
},
v9 = {
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
v10 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorAId"
  }
],
v11 = [
  (v6/*:: as any*/)
],
v12 = [
  (v5/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      {
        "args": (v11/*:: as any*/),
        "kind": "FragmentSpread",
        "name": "ProjectEvaluatorCompareDistributions_evaluator"
      }
    ],
    "type": "ProjectEvaluator",
    "abstractKey": null
  }
],
v13 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorBId"
  }
],
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "threshold",
  "storageKey": null
},
v16 = [
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
  (v14/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "labels",
    "storageKey": null
  },
  (v15/*:: as any*/)
],
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v20 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "optimizationDirection",
    "storageKey": null
  }
],
v21 = [
  (v5/*:: as any*/),
  (v17/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
        "storageKey": null
      },
      (v8/*:: as any*/),
      {
        "alias": null,
        "args": (v11/*:: as any*/),
        "concreteType": "EvaluatorDistribution",
        "kind": "LinkedField",
        "name": "distribution",
        "plural": false,
        "selections": [
          (v15/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "evaluatedCount",
            "storageKey": null
          },
          (v14/*:: as any*/),
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
              (v18/*:: as any*/),
              (v19/*:: as any*/)
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
              (v18/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "isOther",
                "storageKey": null
              },
              (v19/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": null,
        "kind": "LinkedField",
        "name": "evaluator",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "outputConfigs",
            "plural": true,
            "selections": [
              (v5/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": (v20/*:: as any*/),
                "type": "CategoricalAnnotationConfig",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": (v20/*:: as any*/),
                "type": "ContinuousAnnotationConfig",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": (v20/*:: as any*/),
                "type": "FreeformAnnotationConfig",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  (v17/*:: as any*/)
                ],
                "type": "Node",
                "abstractKey": "__isNode"
              }
            ],
            "storageKey": null
          },
          (v17/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "ProjectEvaluator",
    "abstractKey": null
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
                "args": (v7/*:: as any*/),
                "concreteType": "ProjectEvaluatorComparison",
                "kind": "LinkedField",
                "name": "evaluatorComparison",
                "plural": false,
                "selections": [
                  (v8/*:: as any*/),
                  (v9/*:: as any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ProjectEvaluatorCompareStats_comparison"
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
      },
      {
        "alias": "evaluatorA",
        "args": (v10/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v12/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "evaluatorB",
        "args": (v13/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v12/*:: as any*/),
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
                "args": (v7/*:: as any*/),
                "concreteType": "ProjectEvaluatorComparison",
                "kind": "LinkedField",
                "name": "evaluatorComparison",
                "plural": false,
                "selections": [
                  (v8/*:: as any*/),
                  (v9/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "populationSize",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorComparisonSummary",
                    "kind": "LinkedField",
                    "name": "a",
                    "plural": false,
                    "selections": (v16/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorComparisonSummary",
                    "kind": "LinkedField",
                    "name": "b",
                    "plural": false,
                    "selections": (v16/*:: as any*/),
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
          (v17/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "evaluatorA",
        "args": (v10/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v21/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "evaluatorB",
        "args": (v13/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v21/*:: as any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ab1bfc6cc249f54d0b12a15274aaed88",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorCompareContentQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorCompareContentQuery(\n  $projectId: ID!\n  $evaluatorAId: ID!\n  $evaluatorBId: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluatorComparison(evaluatorAId: $evaluatorAId, evaluatorBId: $evaluatorBId, timeRange: $timeRange) {\n        evaluationTarget\n        coverage {\n          evaluatedByBoth\n          onlyA\n          onlyB\n          totalInRange\n        }\n        ...ProjectEvaluatorCompareStats_comparison\n        ...ProjectEvaluatorCompareMatrix_comparison\n      }\n    }\n    id\n  }\n  evaluatorA: node(id: $evaluatorAId) {\n    __typename\n    ... on ProjectEvaluator {\n      ...ProjectEvaluatorCompareDistributions_evaluator_3E0ZE6\n    }\n    id\n  }\n  evaluatorB: node(id: $evaluatorBId) {\n    __typename\n    ... on ProjectEvaluator {\n      ...ProjectEvaluatorCompareDistributions_evaluator_3E0ZE6\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorCompareDistributions_evaluator_3E0ZE6 on ProjectEvaluator {\n  id\n  name\n  evaluationTarget\n  distribution(timeRange: $timeRange) {\n    ...ProjectEvaluatorCompareDistributions_side\n  }\n  evaluator {\n    __typename\n    outputConfigs {\n      __typename\n      ... on CategoricalAnnotationConfig {\n        optimizationDirection\n      }\n      ... on ContinuousAnnotationConfig {\n        optimizationDirection\n      }\n      ... on FreeformAnnotationConfig {\n        optimizationDirection\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorCompareDistributions_side on EvaluatorDistribution {\n  threshold\n  evaluatedCount\n  meanScore\n  scoreBinEdges\n  scoreBinCounts\n  scoreValueCounts {\n    score\n    count\n  }\n  labelCounts {\n    label\n    score\n    isOther\n    count\n  }\n}\n\nfragment ProjectEvaluatorCompareMatrix_comparison on ProjectEvaluatorComparison {\n  evaluationTarget\n  coverage {\n    evaluatedByBoth\n  }\n  populationSize\n  a {\n    annotationName\n    labels\n    threshold\n  }\n  b {\n    annotationName\n    labels\n    threshold\n  }\n  confusionMatrix\n}\n\nfragment ProjectEvaluatorCompareStats_comparison on ProjectEvaluatorComparison {\n  evaluationTarget\n  coverage {\n    evaluatedByBoth\n    onlyA\n    onlyB\n    totalInRange\n  }\n  populationSize\n  a {\n    annotationName\n    flaggedCount\n    flagRate\n    meanScore\n  }\n  b {\n    annotationName\n    flaggedCount\n    flagRate\n    meanScore\n  }\n  statistics {\n    agreement\n    cohensKappa\n    spearmanRho\n    disagreementCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "7313bace8bfbf66efbe7eb2681f18529";

export default node;
