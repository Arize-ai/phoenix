/**
 * @generated SignedSource<<9457c0ba09ae0f4099d2af46aca6c790>>
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
export type EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation$variables = {
  input: PatchDecisionEvaluatorInput;
};
export type EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation$data = {
  readonly patchDecisionEvaluator: {
    readonly evaluator: {
      readonly decisionVersion: {
        readonly id: string;
        readonly sequenceNumber: number;
      };
      readonly id: string;
      readonly inputSchema: any;
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
export type EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation = {
  response: EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation$data;
  variables: EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation$variables;
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
    "name": "EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation",
    "selections": (v2/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "5fd6607f376ebada2a76843c6d631dd6",
    "id": null,
    "metadata": {},
    "name": "EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation(\n  $input: PatchDecisionEvaluatorInput!\n) {\n  patchDecisionEvaluator(input: $input) {\n    evaluator {\n      id\n      inputSchema\n      scoringPolicy {\n        questions {\n          __typename\n          name\n          optimizationDirection\n          ... on DecisionPredicateScoring {\n            threshold\n          }\n          ... on DecisionChoiceScoring {\n            scores {\n              choice\n              score\n            }\n          }\n          ... on DecisionScaleScoring {\n            includeLabel\n          }\n        }\n      }\n      decisionVersion {\n        id\n        sequenceNumber\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "593a26548a0ef83d23d8839d3f7cd499";

export default node;
