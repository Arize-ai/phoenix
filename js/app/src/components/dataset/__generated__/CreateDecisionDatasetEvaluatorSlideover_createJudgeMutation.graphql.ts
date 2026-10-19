/**
 * @generated SignedSource<<7faac10690d60f016ea1566970fcd4dc>>
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
export type CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation$variables = {
  input: CreateDecisionEvaluatorInput;
};
export type CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation$data = {
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
export type CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation = {
  response: CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation$data;
  variables: CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation$variables;
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
    "name": "CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation",
    "selections": (v4/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation",
    "selections": (v4/*:: as any*/)
  },
  "params": {
    "cacheID": "b95cdb10b4f6d2df935a4110286bdecc",
    "id": null,
    "metadata": {},
    "name": "CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation",
    "operationKind": "mutation",
    "text": "mutation CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation(\n  $input: CreateDecisionEvaluatorInput!\n) {\n  createDecisionEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      inputSchema\n      projectionPolicy {\n        questions {\n          __typename\n          name\n          optimizationDirection\n          ... on DecisionPredicateProjection {\n            threshold\n          }\n          ... on DecisionChoiceProjection {\n            scores {\n              choice\n              score\n            }\n          }\n          ... on DecisionScaleProjection {\n            includeLabel\n          }\n        }\n      }\n      decisionVersion {\n        id\n        sequenceNumber\n        decision {\n          id\n          name\n        }\n        questions {\n          __typename\n          ... on DecisionPredicateQuestion {\n            name\n          }\n          ... on DecisionChoiceQuestion {\n            name\n            choices {\n              value\n            }\n          }\n          ... on DecisionScaleQuestion {\n            name\n            levels {\n              label\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f3e66c8eebb81fdb2ef2e5ddc4fe3ae3";

export default node;
