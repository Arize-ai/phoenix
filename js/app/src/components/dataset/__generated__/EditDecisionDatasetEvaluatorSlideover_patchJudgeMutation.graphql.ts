/**
 * @generated SignedSource<<324fa5f6f41cfb9dd83301437e096763>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PatchDecisionEvaluatorInput = {
  decisionVersionId?: string | null;
  description?: string | null;
  evaluatorId: string;
  name?: string | null;
  projectionPolicy?: DecisionProjectionPolicyInput | null;
};
export type DecisionProjectionPolicyInput = {
  questions?: ReadonlyArray<DecisionQuestionProjectionInput>;
};
export type DecisionQuestionProjectionInput = {
  choice?: never;
  predicate: DecisionPredicateProjectionInput;
  scale?: never;
} | {
  choice: DecisionChoiceProjectionInput;
  predicate?: never;
  scale?: never;
} | {
  choice?: never;
  predicate?: never;
  scale: DecisionScaleProjectionInput;
};
export type DecisionPredicateProjectionInput = {
  name: string;
  optimizationDirection?: OptimizationDirection;
  threshold?: number;
};
export type DecisionChoiceProjectionInput = {
  name: string;
  optimizationDirection?: OptimizationDirection;
  scores?: ReadonlyArray<DecisionChoiceScoreInput>;
};
export type DecisionChoiceScoreInput = {
  choice: string;
  score: number;
};
export type DecisionScaleProjectionInput = {
  includeLabel?: boolean;
  name: string;
  optimizationDirection?: OptimizationDirection;
};
export type EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation$variables = {
  input: PatchDecisionEvaluatorInput;
};
export type EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation$data = {
  readonly patchDecisionEvaluator: {
    readonly evaluator: {
      readonly decisionVersion: {
        readonly id: string;
        readonly sequenceNumber: number;
      };
      readonly id: string;
      readonly inputSchema: any;
      readonly projectionPolicy: {
        readonly questions: ReadonlyArray<{
          readonly __typename: string;
          readonly includeLabel?: boolean;
          readonly name: string;
          readonly optimizationDirection: OptimizationDirection;
          readonly scores?: ReadonlyArray<{
            readonly choice: string;
            readonly score: number;
          }>;
          readonly threshold?: number;
        }>;
      };
    };
  };
};
export type EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation = {
  response: EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation$data;
  variables: EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "DecisionEvaluatorMutationPayload",
    "kind": "LinkedField",
    "name": "patchDecisionEvaluator",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DecisionEvaluator",
        "kind": "LinkedField",
        "name": "evaluator",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "inputSchema",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "DecisionProjectionPolicy",
            "kind": "LinkedField",
            "name": "projectionPolicy",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "questions",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
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
                    "name": "optimizationDirection",
                    "storageKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "threshold",
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionPredicateProjection",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionChoiceScore",
                        "kind": "LinkedField",
                        "name": "scores",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "choice",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "score",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionChoiceProjection",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "includeLabel",
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionScaleProjection",
                    "abstractKey": null
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
            "concreteType": "DecisionVersion",
            "kind": "LinkedField",
            "name": "decisionVersion",
            "plural": false,
            "selections": [
              (v1/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "sequenceNumber",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation",
    "selections": (v2/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "40ceee612a77da5067b9f2089a91f3ba",
    "id": null,
    "metadata": {},
    "name": "EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation",
    "operationKind": "mutation",
    "text": "mutation EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation(\n  $input: PatchDecisionEvaluatorInput!\n) {\n  patchDecisionEvaluator(input: $input) {\n    evaluator {\n      id\n      inputSchema\n      projectionPolicy {\n        questions {\n          __typename\n          name\n          optimizationDirection\n          ... on DecisionPredicateProjection {\n            threshold\n          }\n          ... on DecisionChoiceProjection {\n            scores {\n              choice\n              score\n            }\n          }\n          ... on DecisionScaleProjection {\n            includeLabel\n          }\n        }\n      }\n      decisionVersion {\n        id\n        sequenceNumber\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1729e8cc2734073fc13c624c71fe9fe9";

export default node;
