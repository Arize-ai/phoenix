/**
 * @generated SignedSource<<bffc8674abfda61e684a72fc2eb65f28>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type CreateDecisionEvaluatorInput = {
  decisionVersionId: string;
  description?: string | null;
  name: string;
  scoringPolicy?: DecisionScoringPolicyInput | null;
};
export type DecisionScoringPolicyInput = {
  questions?: ReadonlyArray<DecisionQuestionScoringInput>;
};
export type DecisionQuestionScoringInput = {
  choice?: never;
  predicate: DecisionPredicateScoringInput;
  scale?: never;
} | {
  choice: DecisionChoiceScoringInput;
  predicate?: never;
  scale?: never;
} | {
  choice?: never;
  predicate?: never;
  scale: DecisionScaleScoringInput;
};
export type DecisionPredicateScoringInput = {
  name: string;
  optimizationDirection?: OptimizationDirection;
  threshold?: number;
};
export type DecisionChoiceScoringInput = {
  name: string;
  optimizationDirection?: OptimizationDirection;
  scores?: ReadonlyArray<DecisionChoiceScoreInput>;
};
export type DecisionChoiceScoreInput = {
  choice: string;
  score: number;
};
export type DecisionScaleScoringInput = {
  includeLabel?: boolean;
  name: string;
  optimizationDirection?: OptimizationDirection;
};
export type CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation$variables = {
  input: CreateDecisionEvaluatorInput;
};
export type CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation$data = {
  readonly createDecisionEvaluator: {
    readonly evaluator: {
      readonly decisionVersion: {
        readonly decision: {
          readonly id: string;
          readonly name: string;
        };
        readonly id: string;
        readonly questions: ReadonlyArray<{
          readonly __typename: "DecisionChoiceQuestion";
          readonly choices: ReadonlyArray<{
            readonly value: string;
          }>;
          readonly name: string;
        } | {
          readonly __typename: "DecisionPredicateQuestion";
          readonly name: string;
        } | {
          readonly __typename: "DecisionScaleQuestion";
          readonly levels: ReadonlyArray<{
            readonly label: string;
          }>;
          readonly name: string;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        }>;
        readonly sequenceNumber: number;
      };
      readonly id: string;
      readonly inputSchema: any;
      readonly name: string;
      readonly scoringPolicy: {
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
export type CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation = {
  response: CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation$data;
  variables: CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation$variables;
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
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = [
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
    "name": "createDecisionEvaluator",
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
          (v2/*:: as any*/),
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
            "concreteType": "DecisionScoringPolicy",
            "kind": "LinkedField",
            "name": "scoringPolicy",
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
                  (v3/*:: as any*/),
                  (v2/*:: as any*/),
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
                    "type": "DecisionPredicateScoring",
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
                    "type": "DecisionChoiceScoring",
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
                    "type": "DecisionScaleScoring",
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
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "Decision",
                "kind": "LinkedField",
                "name": "decision",
                "plural": false,
                "selections": [
                  (v1/*:: as any*/),
                  (v2/*:: as any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "questions",
                "plural": true,
                "selections": [
                  (v3/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v2/*:: as any*/)
                    ],
                    "type": "DecisionPredicateQuestion",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v2/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionChoiceOption",
                        "kind": "LinkedField",
                        "name": "choices",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "value",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionChoiceQuestion",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v2/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionScaleLevel",
                        "kind": "LinkedField",
                        "name": "levels",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "label",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionScaleQuestion",
                    "abstractKey": null
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
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation",
    "selections": (v4/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation",
    "selections": (v4/*:: as any*/)
  },
  "params": {
    "cacheID": "ea0506ed19e4f8840cfdf78d658d1311",
    "id": null,
    "metadata": {},
    "name": "CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation(\n  $input: CreateDecisionEvaluatorInput!\n) {\n  createDecisionEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      inputSchema\n      scoringPolicy {\n        questions {\n          __typename\n          name\n          optimizationDirection\n          ... on DecisionPredicateScoring {\n            threshold\n          }\n          ... on DecisionChoiceScoring {\n            scores {\n              choice\n              score\n            }\n          }\n          ... on DecisionScaleScoring {\n            includeLabel\n          }\n        }\n      }\n      decisionVersion {\n        id\n        sequenceNumber\n        decision {\n          id\n          name\n        }\n        questions {\n          __typename\n          ... on DecisionPredicateQuestion {\n            name\n          }\n          ... on DecisionChoiceQuestion {\n            name\n            choices {\n              value\n            }\n          }\n          ... on DecisionScaleQuestion {\n            name\n            levels {\n              label\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4cb1a5c526f5a64330a35bcfd4062ecb";

export default node;
