/**
 * @generated SignedSource<<13eb8742c856ef5a1a3f3d56afc76cb6>>
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
v9 = [
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
    "name": "meanScore",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "labels",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "threshold",
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
                    "selections": (v9/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorComparisonSide",
                    "kind": "LinkedField",
                    "name": "sideB",
                    "plural": false,
                    "selections": (v9/*:: as any*/),
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
    "cacheID": "c27e69f78b28ce69e7614fe18717c935",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorCompareContentQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorCompareContentQuery(\n  $projectId: ID!\n  $evaluatorAId: ID!\n  $evaluatorBId: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluatorComparison(evaluatorAId: $evaluatorAId, evaluatorBId: $evaluatorBId, timeRange: $timeRange) {\n        evaluationTarget\n        coverage {\n          evaluatedByBoth\n          onlyA\n          onlyB\n          totalInRange\n        }\n        ...ProjectEvaluatorCompareStats_comparison\n        ...ProjectEvaluatorCompareMatrix_comparison\n      }\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorCompareMatrix_comparison on ProjectEvaluatorComparison {\n  evaluationTarget\n  coverage {\n    evaluatedByBoth\n  }\n  sideA {\n    labels\n    threshold\n  }\n  sideB {\n    labels\n    threshold\n  }\n  confusionMatrix\n}\n\nfragment ProjectEvaluatorCompareStats_comparison on ProjectEvaluatorComparison {\n  evaluationTarget\n  coverage {\n    evaluatedByBoth\n    onlyA\n    onlyB\n    totalInRange\n  }\n  sideA {\n    flaggedCount\n    flagRate\n    meanScore\n  }\n  sideB {\n    flaggedCount\n    flagRate\n    meanScore\n  }\n  statistics {\n    agreement\n    cohensKappa\n    spearmanRho\n    disagreementCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "09721b52b4a7a5e0b5dbc9a0df483a08";

export default node;
